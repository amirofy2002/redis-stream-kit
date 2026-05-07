# redis-stream-producer-consumer

Tiny TypeScript wrapper over Redis Streams. Inject your own Redis client.

## Install

```
npm install redis-stream-producer-consumer
```

## Usage

```ts
import Redis from 'ioredis';
import { Producer, Consumer } from 'redis-stream-producer-consumer';

const client = new Redis({ host: 'localhost', port: 6379 });

const producer = new Producer<{ foo: string }>(client, 'my-stream');
await producer.start();
await producer.emit({ foo: 'bar' });

const consumer = new Consumer<{ foo: string }>(
  client,
  'my-stream',
  'my-group',
  async (data) => { console.log(data.foo); },
);
await consumer.start();
```

See `docs/superpowers/specs/` for full design.
