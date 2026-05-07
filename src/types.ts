export interface RedisLike {
  xadd(stream: string, ...args: (string | number)[]): Promise<string | null>;
  xreadgroup(...args: (string | number)[]): Promise<unknown>;
  xack(stream: string, group: string, ...ids: string[]): Promise<number>;
  xgroup(...args: (string | number)[]): Promise<unknown>;
  xautoclaim(...args: (string | number)[]): Promise<unknown>;
}

export interface Logger {
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
}

export interface ProducerOptions {
  maxLen?: number;
}

export interface MessageMeta {
  id: string;
  attempt: number;
  stream: string;
  group: string;
  consumer: string;
}

export type Handler<T> = (data: T, meta: MessageMeta) => void | Promise<void>;
export type ErrorHandler<T> = (
  err: unknown,
  data: T | Record<string, unknown>,
  meta: MessageMeta,
) => void | Promise<void>;

export interface AutoClaimOptions {
  idleMs: number;
  intervalMs: number;
}

export interface ConsumerOptions<T = unknown> {
  consumerName?: string;
  concurrency?: number;
  blockMs?: number;
  batchSize?: number;
  createIfMissing?: boolean;
  onError?: ErrorHandler<T>;
  autoClaim?: AutoClaimOptions;
  shutdownMs?: number;
  logger?: Logger;
}
