import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode } from '../src/codec.js';

test('encode flattens object to alternating field/value array', () => {
  const out = encode({ foo: 'bar', n: 1 });
  assert.deepEqual(out, ['foo', '"bar"', 'n', '1']);
});

test('encode skips undefined values', () => {
  const out = encode({ a: 1, b: undefined, c: 'x' });
  assert.deepEqual(out, ['a', '1', 'c', '"x"']);
});

test('encode handles nested objects via JSON', () => {
  const out = encode({ obj: { k: 'v' }, arr: [1, 2] });
  assert.deepEqual(out, ['obj', '{"k":"v"}', 'arr', '[1,2]']);
});

test('decode parses field array back to object', () => {
  const obj = decode(['foo', '"bar"', 'n', '1']);
  assert.deepEqual(obj, { foo: 'bar', n: 1 });
});

test('decode round-trips encode', () => {
  const original = { x: 'y', count: 42, nested: { a: [1, 2] }, flag: true };
  const fields = encode(original);
  const back = decode(fields);
  assert.deepEqual(back, original);
});

test('decode throws on bad JSON value', () => {
  assert.throws(() => decode(['foo', '{not-json']), /JSON/);
});

test('decode throws on odd field count', () => {
  assert.throws(() => decode(['foo', '"bar"', 'orphan']), /even/);
});

test('encode throws on non-object', () => {
  assert.throws(() => encode(null as unknown as Record<string, unknown>));
  assert.throws(() => encode(42 as unknown as Record<string, unknown>));
});
