import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Producer } from '../src/producer.js';
import type { RedisLike } from '../src/types.js';

function fakeClient(): { client: RedisLike; calls: { xadd: unknown[][]; xgroup: unknown[][] } } {
  const calls = { xadd: [] as unknown[][], xgroup: [] as unknown[][] };
  const client: RedisLike = {
    xadd: async (...args) => { calls.xadd.push(args); return '1-0'; },
    xreadgroup: async () => null,
    xack: async () => 1,
    xgroup: async (...args) => { calls.xgroup.push(args); return 'OK'; },
    xautoclaim: async () => ['0-0', [], []],
  };
  return { client, calls };
}

test('start() does not create a group (group bootstrap is consumer-side)', async () => {
  const { client, calls } = fakeClient();
  const p = new Producer(client, 'stream-x');
  await p.start();
  assert.equal(calls.xgroup.length, 0);
});

test('emit() calls XADD with encoded fields', async () => {
  const { client, calls } = fakeClient();
  const p = new Producer<{ foo: string; n: number }>(client, 'stream-x');
  await p.start();
  const id = await p.emit({ foo: 'bar', n: 7 });
  assert.equal(id, '1-0');
  assert.deepEqual(calls.xadd[0], ['stream-x', '*', 'foo', '"bar"', 'n', '7']);
});

test('emit() includes MAXLEN ~ N when configured', async () => {
  const { client, calls } = fakeClient();
  const p = new Producer(client, 's', { maxLen: 1000 });
  await p.emit({ a: 1 });
  assert.deepEqual(calls.xadd[0], ['s', 'MAXLEN', '~', 1000, '*', 'a', '1']);
});

test('emit() throws if stop()ped', async () => {
  const { client } = fakeClient();
  const p = new Producer(client, 's');
  await p.stop();
  await assert.rejects(() => p.emit({ a: 1 }), /stopped/);
});
