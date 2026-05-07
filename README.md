# redis-stream-kit

Tiny TypeScript wrapper over Redis Streams. Inject your own Redis client.

## Install

```bash
npm install redis-stream-kit ioredis
```

## Quick start

```ts
import Redis from "ioredis";
import { Producer, Consumer } from "redis-stream-kit";

const client = new Redis({ host: "localhost", port: 6379 });

interface Event {
  userId: string;
  action: string;
}

const producer = new Producer<Event>(client, "events", { maxLen: 10000 });
await producer.start();
await producer.emit({ userId: "u1", action: "login" });

const consumer = new Consumer<Event>(
  client,
  "events",
  "workers",
  async (data, meta) => {
    console.log(meta.id, data.userId, data.action);
  },
  {
    concurrency: 4,
    onError: (err, data, meta) => console.error("handler failed", meta.id, err),
    autoClaim: { idleMs: 60_000, intervalMs: 30_000 },
  },
);
await consumer.start();
```

## API

### `new Producer<T>(client, stream, options?)`

Options: `{ maxLen?: number }`.

- `start()` — no-op marker; safe to call.
- `emit(payload)` — `XADD`, returns the message ID.
- `stop()` — marks producer stopped; further `emit` throws.

### `new Consumer<T>(client, stream, group, handler, options?)`

Options:

| key               | default              | meaning                                     |
| ----------------- | -------------------- | ------------------------------------------- |
| `consumerName`    | `${hostname}-${pid}` | identifier in the group                     |
| `concurrency`     | 1                    | parallel handler workers                    |
| `blockMs`         | 5000                 | XREADGROUP BLOCK ms                         |
| `batchSize`       | 10                   | XREADGROUP COUNT                            |
| `createIfMissing` | true                 | bootstrap stream + group                    |
| `onError`         | —                    | called on handler/decode failure; no-ack    |
| `autoClaim`       | off                  | `{ idleMs, intervalMs }` for stale recovery |
| `shutdownMs`      | 30000                | graceful-stop timeout                       |
| `logger`          | —                    | `{ info, warn, error }`                     |

Events emitted: `message`, `ack`, `claim`, `error`.

## How it works

- Each top-level field of your payload is JSON-encoded into a separate Redis stream field.
- Decode is symmetric; non-JSON values fail through `onError`, message is left un-acked.
- Handler success → `XACK`. Handler throw or decode failure → no ack; message stays pending and can be recovered by `XAUTOCLAIM`.

## Requirements

- Node ≥18
- Redis ≥6.2 (XAUTOCLAIM)

## License

MIT
