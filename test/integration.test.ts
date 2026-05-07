import { test } from 'node:test';
import assert from 'node:assert/strict';
import Redis from 'ioredis';
import { Producer, Consumer } from '../src/index.js';

const url = process.env.REDIS_URL;
const skip = !url;

test('end-to-end emit/consume', { skip }, async () => {
  const client = new Redis(url!);
  const stream = `test-stream-${Date.now()}`;
  const group = 'test-group';

  const producer = new Producer<{ greeting: string }>(client, stream);
  await producer.start();

  const seen: { greeting: string }[] = [];
  const consumer = new Consumer<{ greeting: string }>(
    client, stream, group,
    async (data) => { seen.push(data); },
    { blockMs: 100, shutdownMs: 1000 },
  );
  await consumer.start();
  await producer.emit({ greeting: 'hello' });
  await producer.emit({ greeting: 'world' });

  for (let i = 0; i < 50 && seen.length < 2; i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  await consumer.stop();
  await producer.stop();
  await client.quit();

  assert.equal(seen.length, 2);
  assert.equal(seen[0]?.greeting, 'hello');
  assert.equal(seen[1]?.greeting, 'world');
});

test('autoClaim recovers a pending message from a dead consumer', { skip }, async () => {
  const client = new Redis(url!);
  const stream = `test-claim-${Date.now()}`;
  const group = 'g';

  const producer = new Producer<{ n: number }>(client, stream);
  await producer.start();

  const aErrors: unknown[] = [];
  const a = new Consumer<{ n: number }>(
    client, stream, group,
    async () => { throw new Error('A fails'); },
    {
      consumerName: 'A', blockMs: 100, shutdownMs: 1000,
      onError: (e) => { aErrors.push(e); },
    },
  );
  await a.start();
  await producer.emit({ n: 1 });
  for (let i = 0; i < 50 && aErrors.length === 0; i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  await a.stop();

  const seen: { n: number }[] = [];
  const b = new Consumer<{ n: number }>(
    client, stream, group,
    async (data) => { seen.push(data); },
    {
      consumerName: 'B', blockMs: 50, shutdownMs: 1000,
      autoClaim: { idleMs: 100, intervalMs: 50 },
    },
  );
  await b.start();
  for (let i = 0; i < 100 && seen.length === 0; i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  await b.stop();
  await producer.stop();
  await client.quit();

  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.n, 1);
});
