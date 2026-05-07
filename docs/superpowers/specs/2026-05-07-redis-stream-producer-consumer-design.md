# redis-stream-producer-consumer — Design

Date: 2026-05-07
Status: Approved (brainstorming)

## Goal

TypeScript library that hides Redis Streams complexity behind two classes:
`Producer<T>` and `Consumer<T>`. Published to npm. Zero runtime deps; user
injects a Redis client.

## Public API

```ts
const producer = new Producer<MyMsg>(client, 'streamName', { maxLen: 10000 });
await producer.start();
await producer.emit({ foo: 'bar', n: 1 }); // returns Redis message ID
await producer.stop();

const consumer = new Consumer<MyMsg>(
  client,
  'streamName',
  'groupName',
  async (data, meta) => { /* handle */ },
  {
    consumerName,        // default: hostname-pid
    concurrency: 1,
    blockMs: 5000,
    batchSize: 10,
    createIfMissing: true,
    onError: (err, data, meta) => {}, // default: no-ack
    autoClaim: { idleMs: 60000, intervalMs: 30000 }, // opt-in
    shutdownMs: 30000,
    logger,              // optional {info,warn,error}
  },
);
await consumer.start();
await consumer.stop();
```

## Architecture

```
src/
  index.ts        public exports
  producer.ts     Producer<T>
  consumer.ts     Consumer<T> (extends EventEmitter)
  codec.ts        encode/decode JSON-per-field
  bootstrap.ts    XGROUP CREATE MKSTREAM helper
  types.ts        RedisLike interface, options
test/
  codec.test.ts
  producer.test.ts
  consumer.test.ts
  integration.test.ts   gated by REDIS_URL
```

### RedisLike contract

Minimal injected interface; ioredis and node-redis (wrapped) both fit:

```ts
interface RedisLike {
  xadd(stream: string, ...args: (string | number)[]): Promise<string>;
  xreadgroup(...args: (string | number)[]): Promise<unknown>;
  xack(stream: string, group: string, ...ids: string[]): Promise<number>;
  xgroup(...args: (string | number)[]): Promise<unknown>;
  xautoclaim(...args: (string | number)[]): Promise<unknown>;
}
```

## Data flow

### Producer.emit(obj)

1. For each top-level key `k`: push `k`, `JSON.stringify(obj[k])` into fields.
   `undefined` values skipped.
2. `XADD stream [MAXLEN ~ N] * f1 v1 f2 v2 ...`
3. Return message ID.

### Consumer loop (per worker, N = concurrency)

1. `XREADGROUP GROUP g c COUNT batchSize BLOCK blockMs STREAMS stream >`
2. For each entry: decode fields by `JSON.parse` per value into typed object.
3. Invoke handler. On success → `XACK`. On throw → call `onError`, no-ack.
4. Repeat until `stop()`; uses AbortController for shutdown.

### Auto-claim worker (opt-in)

`setInterval(intervalMs)` runs `XAUTOCLAIM stream group consumer idleMs 0-0
COUNT batchSize`. Claimed entries dispatch through same handler path.

### Bootstrap

`XGROUP CREATE stream group $ MKSTREAM`. BUSYGROUP error swallowed.

## Error handling

| Case | Behavior |
|---|---|
| Decode failure | onError(err, rawFields, meta); no-ack |
| Handler throw | onError(err, data, meta); no-ack; eligible for autoClaim |
| Connection loss | logger.warn; retry XREADGROUP with backoff (100ms→2s) |
| stop() in-flight | AbortController; await handlers; force exit after shutdownMs |
| Empty XREADGROUP | loop |
| BUSYGROUP on bootstrap | swallow |
| NOGROUP mid-loop | emit 'error'; throw fatal |

Consumer events: `error`, `message`, `ack`, `claim`.

## Testing

- Unit (mocked RedisLike): codec round-trip; producer XADD args; consumer
  ack/no-ack/onError, concurrency, graceful stop, autoClaim path.
- Integration (gated by `REDIS_URL`): end-to-end emit→consume; bootstrap;
  autoClaim recovery; multi-consumer load split.
- Coverage target ≥85% on `src/`.

## Tooling

- TypeScript strict, target ES2022.
- Build: `tsc` two-pass → `dist/esm` + `dist/cjs`. `exports` map for dual.
- Tests: Node built-in `node:test` + `tsc` (no Vitest/Jest).
- Node ≥18.
- Runtime deps: none. Peer deps: none (client injected).
- Dev deps: typescript, @types/node.
- Scripts: `build`, `test`, `test:integration`, `prepublishOnly`.

## Out of scope (YAGNI)

- Reconnection logic (client's job).
- Schema validation (user wraps handler).
- Multi-stream consumer.
- Retry/backoff metadata in payload.
- Dead-letter stream (user implements via onError).
