import { encode } from './codec.js';
import type { ProducerOptions, RedisLike } from './types.js';

export class Producer<T extends Record<string, unknown> = Record<string, unknown>> {
  private started = false;
  private stopped = false;

  constructor(
    private readonly client: RedisLike,
    private readonly stream: string,
    private readonly options: ProducerOptions = {},
  ) {}

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
  }

  async emit(payload: T): Promise<string> {
    if (this.stopped) throw new Error('Producer is stopped');
    const fields = encode(payload as Record<string, unknown>);
    const args: (string | number)[] = [];
    if (this.options.maxLen !== undefined) {
      args.push('MAXLEN', '~', this.options.maxLen);
    }
    args.push('*', ...fields);
    const id = await this.client.xadd(this.stream, ...args);
    if (id == null) throw new Error('XADD returned null');
    return id;
  }

  async stop(): Promise<void> {
    this.stopped = true;
  }
}
