import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureGroup } from '../src/bootstrap.js';
import type { RedisLike } from '../src/types.js';

function fakeClient(impl: Partial<RedisLike>): RedisLike {
  return {
    xadd: async () => '1-0',
    xreadgroup: async () => null,
    xack: async () => 1,
    xgroup: async () => 'OK',
    xautoclaim: async () => ['0-0', [], []],
    ...impl,
  };
}

test('ensureGroup calls XGROUP CREATE MKSTREAM with $', async () => {
  const calls: unknown[][] = [];
  const client = fakeClient({
    xgroup: async (...args) => { calls.push(args); return 'OK'; },
  });
  await ensureGroup(client, 'my-stream', 'my-group');
  assert.deepEqual(calls[0], ['CREATE', 'my-stream', 'my-group', '$', 'MKSTREAM']);
});

test('ensureGroup swallows BUSYGROUP error', async () => {
  const client = fakeClient({
    xgroup: async () => { throw new Error('BUSYGROUP Consumer Group name already exists'); },
  });
  await assert.doesNotReject(() => ensureGroup(client, 's', 'g'));
});

test('ensureGroup rethrows other errors', async () => {
  const client = fakeClient({
    xgroup: async () => { throw new Error('NOAUTH Authentication required'); },
  });
  await assert.rejects(() => ensureGroup(client, 's', 'g'), /NOAUTH/);
});
