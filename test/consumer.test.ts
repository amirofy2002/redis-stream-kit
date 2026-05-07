import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Consumer } from '../src/consumer.js';
import type { RedisLike } from '../src/types.js';

type XReadGroupReply = [string, [string, string[]][]][] | null;

function makeClient(replies: XReadGroupReply[]): {
  client: RedisLike;
  acks: string[][];
  groupCalls: unknown[][];
} {
  const acks: string[][] = [];
  const groupCalls: unknown[][] = [];
  let i = 0;
  const client: RedisLike = {
    xadd: async () => '1-0',
    xreadgroup: async () => {
      const reply = replies[i] ?? null;
      i = Math.min(i + 1, replies.length);
      return reply;
    },
    xack: async (_s, _g, ...ids) => { acks.push(ids); return ids.length; },
    xgroup: async (...args) => { groupCalls.push(args); return 'OK'; },
    xautoclaim: async () => ['0-0', [], []],
  };
  return { client, acks, groupCalls };
}

test('consumer acks message after successful handler', async () => {
  const reply: XReadGroupReply = [['s', [['1-0', ['foo', '"bar"']]]]];
  const { client, acks } = makeClient([reply, null]);
  const handled: unknown[] = [];
  const c = new Consumer<{ foo: string }>(
    client, 's', 'g', async (data) => { handled.push(data); },
    { blockMs: 10, shutdownMs: 200 },
  );
  await c.start();
  await new Promise((r) => setTimeout(r, 50));
  await c.stop();
  assert.deepEqual(handled[0], { foo: 'bar' });
  assert.deepEqual(acks[0], ['1-0']);
});

test('handler throw triggers onError, no ack', async () => {
  const reply: XReadGroupReply = [['s', [['2-0', ['x', '1']]]]];
  const { client, acks } = makeClient([reply, null]);
  const errors: unknown[] = [];
  const c = new Consumer(
    client, 's', 'g',
    async () => { throw new Error('boom'); },
    {
      blockMs: 10, shutdownMs: 200,
      onError: (err) => { errors.push(err); },
    },
  );
  await c.start();
  await new Promise((r) => setTimeout(r, 50));
  await c.stop();
  assert.equal((errors[0] as Error).message, 'boom');
  assert.equal(acks.length, 0);
});

test('start() bootstraps group when createIfMissing default true', async () => {
  const { client, groupCalls } = makeClient([null]);
  const c = new Consumer(client, 's', 'g', async () => {}, { blockMs: 10, shutdownMs: 100 });
  await c.start();
  await c.stop();
  assert.deepEqual(groupCalls[0], ['CREATE', 's', 'g', '$', 'MKSTREAM']);
});

test('createIfMissing=false skips bootstrap', async () => {
  const { client, groupCalls } = makeClient([null]);
  const c = new Consumer(client, 's', 'g', async () => {}, {
    blockMs: 10, shutdownMs: 100, createIfMissing: false,
  });
  await c.start();
  await c.stop();
  assert.equal(groupCalls.length, 0);
});

test('decode failure routed through onError', async () => {
  const reply: XReadGroupReply = [['s', [['3-0', ['bad', '{not-json']]]]];
  const { client, acks } = makeClient([reply, null]);
  const errors: unknown[] = [];
  const c = new Consumer(client, 's', 'g', async () => {}, {
    blockMs: 10, shutdownMs: 200,
    onError: (err) => { errors.push(err); },
  });
  await c.start();
  await new Promise((r) => setTimeout(r, 50));
  await c.stop();
  assert.match((errors[0] as Error).message, /JSON|decode/);
  assert.equal(acks.length, 0);
});

test('concurrency: runs N workers in parallel', async () => {
  const inFlight = { now: 0, max: 0 };
  const reply = (id: string): XReadGroupReply => [['s', [[id, ['x', '1']]]]];
  const replies: XReadGroupReply[] = [reply('1-0'), reply('2-0'), reply('3-0'), null, null, null];
  const { client } = makeClient(replies);

  const c = new Consumer(client, 's', 'g',
    async () => {
      inFlight.now++;
      inFlight.max = Math.max(inFlight.max, inFlight.now);
      await new Promise((r) => setTimeout(r, 30));
      inFlight.now--;
    },
    { blockMs: 5, shutdownMs: 300, concurrency: 3 },
  );
  await c.start();
  await new Promise((r) => setTimeout(r, 80));
  await c.stop();
  assert.ok(inFlight.max >= 2, `expected concurrent execution, max=${inFlight.max}`);
});

test('autoClaim: periodically claims stale messages', async () => {
  const claimReply: unknown = ['0-0', [['9-0', ['foo', '"claimed"']]], []];
  let claimCount = 0;
  const client: RedisLike = {
    xadd: async () => '1-0',
    xreadgroup: async () => null,
    xack: async () => 1,
    xgroup: async () => 'OK',
    xautoclaim: async () => { claimCount++; return claimReply; },
  };
  const seen: unknown[] = [];
  const c = new Consumer<{ foo: string }>(
    client, 's', 'g',
    async (data) => { seen.push(data); },
    {
      blockMs: 5, shutdownMs: 300,
      autoClaim: { idleMs: 1000, intervalMs: 30 },
    },
  );
  await c.start();
  await new Promise((r) => setTimeout(r, 80));
  await c.stop();
  assert.ok(claimCount >= 1, 'XAUTOCLAIM was called at least once');
  assert.deepEqual(seen[0], { foo: 'claimed' });
});
