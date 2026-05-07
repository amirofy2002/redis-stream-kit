import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RedisLike, ProducerOptions, ConsumerOptions } from '../src/types.js';

test('RedisLike compiles with minimal subset', () => {
  const fake: RedisLike = {
    xadd: async () => '1-0',
    xreadgroup: async () => null,
    xack: async () => 1,
    xgroup: async () => 'OK',
    xautoclaim: async () => ['0-0', [], []],
  };
  assert.equal(typeof fake.xadd, 'function');
});

test('ProducerOptions allows maxLen optional', () => {
  const a: ProducerOptions = {};
  const b: ProducerOptions = { maxLen: 1000 };
  assert.equal(b.maxLen, 1000);
  assert.equal(a.maxLen, undefined);
});

test('ConsumerOptions defaults are all optional', () => {
  const opts: ConsumerOptions<{ x: number }> = {};
  assert.equal(opts.concurrency, undefined);
});
