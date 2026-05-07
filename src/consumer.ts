import { EventEmitter } from "node:events";
import { hostname } from "node:os";
import { decode } from "./codec.js";
import { ensureGroup } from "./bootstrap.js";
import type {
  ConsumerOptions,
  ErrorHandler,
  Handler,
  MessageMeta,
  RedisLike,
} from "./types.js";

type XStream = [string, [string, string[]][]][];

const DEFAULTS = {
  concurrency: 1,
  blockMs: 5000,
  batchSize: 10,
  createIfMissing: true,
  shutdownMs: 30000,
};

export class Consumer<T = unknown> extends EventEmitter {
  private running = false;
  private workers: Promise<void>[] = [];
  private abort = new AbortController();
  private fatalError?: unknown;
  private readonly consumerName: string;
  private readonly opts: Required<
    Omit<
      ConsumerOptions<T>,
      "onError" | "autoClaim" | "logger" | "consumerName"
    >
  > & {
    onError?: ErrorHandler<T>;
    autoClaim?: ConsumerOptions<T>["autoClaim"];
    logger?: ConsumerOptions<T>["logger"];
  };

  constructor(
    private readonly client: RedisLike,
    private readonly stream: string,
    private readonly group: string,
    private readonly handler: Handler<T>,
    options: ConsumerOptions<T> = {},
  ) {
    super();
    this.consumerName = options.consumerName ?? `${hostname()}-${process.pid}`;
    const opts: Required<
      Omit<
        ConsumerOptions<T>,
        "onError" | "autoClaim" | "logger" | "consumerName"
      >
    > & {
      onError?: ErrorHandler<T>;
      autoClaim?: ConsumerOptions<T>["autoClaim"];
      logger?: ConsumerOptions<T>["logger"];
    } = {
      concurrency: options.concurrency ?? DEFAULTS.concurrency,
      blockMs: options.blockMs ?? DEFAULTS.blockMs,
      batchSize: options.batchSize ?? DEFAULTS.batchSize,
      createIfMissing: options.createIfMissing ?? DEFAULTS.createIfMissing,
      shutdownMs: options.shutdownMs ?? DEFAULTS.shutdownMs,
    };
    if (options.onError !== undefined) opts.onError = options.onError;
    if (options.autoClaim !== undefined) opts.autoClaim = options.autoClaim;
    if (options.logger !== undefined) opts.logger = options.logger;
    this.opts = opts;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    if (this.opts.createIfMissing) {
      await ensureGroup(this.client, this.stream, this.group);
    }
    const wrap = (p: Promise<void>): Promise<void> =>
      p.catch((err) => {
        this.fatalError = err;
        if (this.listenerCount("error") > 0) this.emit("error", err);
        this.running = false;
        this.abort.abort();
      });
    for (let i = 0; i < this.opts.concurrency; i++) {
      this.workers.push(wrap(this.runWorker()));
    }
    if (this.opts.autoClaim) {
      this.workers.push(wrap(this.runAutoClaim()));
    }
  }

  async stop(): Promise<void> {
    if (!this.running && !this.fatalError) return;
    this.running = false;
    this.abort.abort();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("shutdown timeout")),
        this.opts.shutdownMs,
      );
    });
    try {
      await Promise.race([Promise.all(this.workers), timeout]);
    } catch (err) {
      this.opts.logger?.warn("consumer shutdown forced", err);
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (this.fatalError) {
      const err = this.fatalError;
      this.fatalError = undefined;
      throw err;
    }
  }

  private async runWorker(): Promise<void> {
    while (this.running) {
      let reply: XStream | null = null;
      try {
        reply = (await this.client.xreadgroup(
          "GROUP",
          this.group,
          this.consumerName,
          "COUNT",
          this.opts.batchSize,
          "BLOCK",
          this.opts.blockMs,
          "STREAMS",
          this.stream,
          ">",
        )) as XStream | null;
      } catch (err) {
        if (!this.running) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("NOGROUP")) {
          this.emit("error", err);
          throw err;
        }
        this.opts.logger?.warn("XREADGROUP failed; retrying", err);
        await this.sleep(200);
        continue;
      }
      if (!reply) {
        await this.sleep(0);
        continue;
      }
      for (const [, entries] of reply) {
        for (const [id, fields] of entries) {
          await this.dispatch(id, fields, 1);
        }
      }
    }
  }

  private async runAutoClaim(): Promise<void> {
    const ac = this.opts.autoClaim!;
    let cursor = "0-0";
    while (this.running) {
      await this.sleep(ac.intervalMs);
      if (!this.running) return;
      try {
        const result = (await this.client.xautoclaim(
          this.stream,
          this.group,
          this.consumerName,
          ac.idleMs,
          cursor,
          "COUNT",
          this.opts.batchSize,
        )) as [string, [string, string[]][], string[]] | null;
        if (!result) continue;
        const [nextCursor, claimed] = result;
        cursor = nextCursor || "0-0";
        for (const [id, fields] of claimed) {
          await this.dispatch(id, fields, 2);
        }
      } catch (err) {
        this.opts.logger?.warn("XAUTOCLAIM failed", err);
      }
    }
  }

  private async dispatch(
    id: string,
    fields: string[],
    attempt: number,
  ): Promise<void> {
    const meta: MessageMeta = {
      id,
      attempt,
      stream: this.stream,
      group: this.group,
      consumer: this.consumerName,
    };
    if (attempt > 1) this.emit("claim", id, meta);
    let data: T;
    try {
      data = decode(fields) as T;
    } catch (err) {
      await this.runOnError(err, fields as unknown as T, meta);
      return;
    }
    this.emit("message", data, meta);
    try {
      await this.handler(data, meta);
    } catch (err) {
      await this.runOnError(err, data, meta);
      return;
    }
    try {
      await this.client.xack(this.stream, this.group, id);
      this.emit("ack", id, meta);
    } catch (err) {
      this.opts.logger?.warn("XACK failed", err);
      if (this.listenerCount("error") > 0) this.emit("error", err, meta);
    }
  }

  private async runOnError(
    err: unknown,
    data: T | Record<string, unknown>,
    meta: MessageMeta,
  ): Promise<void> {
    if (this.listenerCount("error") > 0) {
      this.emit("error", err, meta);
    }
    if (!this.opts.onError) return;
    try {
      await this.opts.onError(err, data, meta);
    } catch (cbErr) {
      this.opts.logger?.error("onError callback threw", cbErr);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const signal = this.abort.signal;
      if (signal.aborted) return resolve();
      const onAbort = () => {
        clearTimeout(t);
        resolve();
      };
      const t = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}
