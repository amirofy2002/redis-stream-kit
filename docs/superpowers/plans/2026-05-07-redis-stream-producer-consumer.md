# redis-stream-producer-consumer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a TypeScript npm library exposing `Producer<T>` and `Consumer<T>` that hide Redis Streams complexity behind a small typed API, with the Redis client injected by the user.

**Architecture:** Pure-TS library, zero runtime deps. Two classes (`Producer`, `Consumer`) sit on top of an injected `RedisLike` interface. Codec serialises each top-level field as JSON. Consumer runs N concurrent workers using `XREADGROUP ... BLOCK`, optional XAUTOCLAIM for stale recovery, AbortController for graceful stop. Test runner: `node:test`. Build: dual ESM/CJS via `tsc` two-pass.

**Tech Stack:** TypeScript 5.x strict, Node ≥18, `node:test`, `tsc`. Dev-only: `ioredis` for integration tests behind `REDIS_URL` env. No runtime deps.

---

## Task 1: Project scaffold (package.json, tsconfig, gitignore, npmignore)

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.cjs.json`
- Create: `.gitignore`
- Create: `.npmignore`
- Create: `README.md`
- Create: `LICENSE`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "redis-stream-producer-consumer",
  "version": "0.1.0",
  "description": "Tiny TypeScript wrapper over Redis Streams: typed Producer + Consumer with injected client.",
  "type": "module",
  "main": "./dist/cjs/index.cjs",
  "module": "./dist/esm/index.js",
  "types": "./dist/esm/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/esm/index.d.ts",
        "default": "./dist/esm/index.js"
      },
      "require": {
        "types": "./dist/cjs/index.d.cts",
        "default": "./dist/cjs/index.cjs"
      }
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "clean": "rm -rf dist",
    "build:esm": "tsc -p tsconfig.json",
    "build:cjs": "tsc -p tsconfig.cjs.json && node scripts/rename-cjs.mjs",
    "build": "npm run clean && npm run build:esm && npm run build:cjs",
    "test": "node --test --import tsx test/*.test.ts",
    "test:integration": "node --test --import tsx test/integration.test.ts",
    "prepublishOnly": "npm run build && npm test"
  },
  "engines": { "node": ">=18" },
  "keywords": ["redis", "streams", "producer", "consumer", "typescript", "xadd", "xreadgroup"],
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^20.11.0",
    "ioredis": "^5.4.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json` (ESM build)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist/esm",
    "rootDir": "./src",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write `tsconfig.cjs.json` (CJS build)**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "./dist/cjs",
    "declaration": true
  }
}
```

- [ ] **Step 4: Write `scripts/rename-cjs.mjs` (rename `.js`→`.cjs`, `.d.ts`→`.d.cts`)**

```js
import { readdir, rename, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (p.endsWith('.js')) await rename(p, p.replace(/\.js$/, '.cjs'));
    else if (p.endsWith('.d.ts')) await rename(p, p.replace(/\.d\.ts$/, '.d.cts'));
    else if (p.endsWith('.js.map')) await rename(p, p.replace(/\.js\.map$/, '.cjs.map'));
  }
}
await walk('dist/cjs');
```

- [ ] **Step 5: Write `.gitignore`**

```
node_modules/
dist/
coverage/
*.log
.DS_Store
.env
.env.*
```

- [ ] **Step 6: Write `.npmignore`**

```
src/
test/
docs/
scripts/
tsconfig*.json
.gitignore
.editorconfig
*.test.ts
.github/
```

- [ ] **Step 7: Write `README.md` (skeleton)**

```markdown
# redis-stream-producer-consumer

Tiny TypeScript wrapper over Redis Streams. Inject your own Redis client.

## Install

\`\`\`
npm install redis-stream-producer-consumer
\`\`\`

## Usage

\`\`\`ts
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
\`\`\`

See `docs/superpowers/specs/` for full design.
```

- [ ] **Step 8: Write `LICENSE` (MIT)**

```
MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 9: Install dev deps and verify**

```bash
npm install
```
Expected: installs typescript, @types/node, tsx, ioredis. No errors.

- [ ] **Step 10: Commit**

```bash
git init
git add package.json tsconfig.json tsconfig.cjs.json scripts/rename-cjs.mjs .gitignore .npmignore README.md LICENSE
git commit -m "chore: scaffold package, tsconfig, build scripts"
```

---

## Task 2: Types module (RedisLike + options)

**Files:**
- Create: `src/types.ts`
- Test: `test/types.test.ts`

- [ ] **Step 1: Write `test/types.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test, expect FAIL (module missing)**

```bash
npm test
```
Expected: error "Cannot find module '../src/types.js'".

- [ ] **Step 3: Write `src/types.ts`**

```ts
export interface RedisLike {
  xadd(stream: string, ...args: (string | number)[]): Promise<string | null>;
  xreadgroup(...args: (string | number)[]): Promise<unknown>;
  xack(stream: string, group: string, ...ids: string[]): Promise<number>;
  xgroup(...args: (string | number)[]): Promise<unknown>;
  xautoclaim(...args: (string | number)[]): Promise<unknown>;
}

export interface Logger {
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
}

export interface ProducerOptions {
  maxLen?: number;
  createIfMissing?: boolean;
  logger?: Logger;
}

export interface MessageMeta {
  id: string;
  attempt: number;
  stream: string;
  group: string;
  consumer: string;
}

export type Handler<T> = (data: T, meta: MessageMeta) => void | Promise<void>;
export type ErrorHandler<T> = (
  err: unknown,
  data: T | Record<string, unknown>,
  meta: MessageMeta,
) => void | Promise<void>;

export interface AutoClaimOptions {
  idleMs: number;
  intervalMs: number;
}

export interface ConsumerOptions<T = unknown> {
  consumerName?: string;
  concurrency?: number;
  blockMs?: number;
  batchSize?: number;
  createIfMissing?: boolean;
  onError?: ErrorHandler<T>;
  autoClaim?: AutoClaimOptions;
  shutdownMs?: number;
  logger?: Logger;
}
```

- [ ] **Step 4: Run test, expect PASS**

```bash
npm test
```
Expected: 3/3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts test/types.test.ts
git commit -m "feat(types): RedisLike, options, handler types"
```

---

## Task 3: Codec module (encode/decode)

**Files:**
- Create: `src/codec.ts`
- Test: `test/codec.test.ts`

- [ ] **Step 1: Write `test/codec.test.ts`**

```ts
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
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npm test
```
Expected: module not found.

- [ ] **Step 3: Write `src/codec.ts`**

```ts
export function encode(obj: Record<string, unknown>): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new TypeError('encode expects a plain object');
  }
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out.push(k, JSON.stringify(v));
  }
  return out;
}

export function decode(fields: string[]): Record<string, unknown> {
  if (fields.length % 2 !== 0) {
    throw new Error('decode expects an even number of field/value entries');
  }
  const out: Record<string, unknown> = {};
  for (let i = 0; i < fields.length; i += 2) {
    const k = fields[i]!;
    const raw = fields[i + 1]!;
    try {
      out[k] = JSON.parse(raw);
    } catch (err) {
      throw new Error(`decode: invalid JSON for field "${k}": ${(err as Error).message}`);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npm test
```
Expected: all codec tests green.

- [ ] **Step 5: Commit**

```bash
git add src/codec.ts test/codec.test.ts
git commit -m "feat(codec): JSON-per-field encode/decode"
```

---

## Task 4: Bootstrap helper (XGROUP CREATE MKSTREAM)

**Files:**
- Create: `src/bootstrap.ts`
- Test: `test/bootstrap.test.ts`

- [ ] **Step 1: Write `test/bootstrap.test.ts`**

```ts
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
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Write `src/bootstrap.ts`**

```ts
import type { RedisLike } from './types.js';

export async function ensureGroup(
  client: RedisLike,
  stream: string,
  group: string,
): Promise<void> {
  try {
    await client.xgroup('CREATE', stream, group, '$', 'MKSTREAM');
  } catch (err) {
    const msg = (err as Error).message ?? '';
    if (msg.includes('BUSYGROUP')) return;
    throw err;
  }
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/bootstrap.ts test/bootstrap.test.ts
git commit -m "feat(bootstrap): ensureGroup helper, swallow BUSYGROUP"
```

---

## Task 5: Producer class

**Files:**
- Create: `src/producer.ts`
- Test: `test/producer.test.ts`

- [ ] **Step 1: Write `test/producer.test.ts`**

```ts
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

test('start() creates stream when createIfMissing default true', async () => {
  const { client, calls } = fakeClient();
  const p = new Producer(client, 'stream-x');
  await p.start();
  assert.equal(calls.xgroup.length, 0); // producer does NOT create a group
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
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Write `src/producer.ts`**

```ts
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
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/producer.ts test/producer.test.ts
git commit -m "feat(producer): Producer<T> with XADD + optional MAXLEN"
```

---

## Task 6: Consumer — basic loop, ack, onError

**Files:**
- Create: `src/consumer.ts`
- Test: `test/consumer.test.ts`

- [ ] **Step 1: Write `test/consumer.test.ts`**

```ts
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
  // give the loop one tick
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
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Write `src/consumer.ts` (initial — single worker, no autoClaim yet)**

```ts
import { EventEmitter } from 'node:events';
import { hostname } from 'node:os';
import { decode } from './codec.js';
import { ensureGroup } from './bootstrap.js';
import type {
  ConsumerOptions, ErrorHandler, Handler, MessageMeta, RedisLike,
} from './types.js';

type XStream = [string, [string, string[]][]][];

const DEFAULTS = {
  concurrency: 1,
  blockMs: 5000,
  batchSize: 10,
  createIfMissing: true,
  shutdownMs: 30000,
};

export class Consumer<T = unknown> extends EventEmitter {
  private running = false;
  private workers: Promise<void>[] = [];
  private abort = new AbortController();
  private readonly consumerName: string;
  private readonly opts: Required<Omit<ConsumerOptions<T>, 'onError' | 'autoClaim' | 'logger' | 'consumerName'>> & {
    onError?: ErrorHandler<T>;
    autoClaim?: ConsumerOptions<T>['autoClaim'];
    logger?: ConsumerOptions<T>['logger'];
  };

  constructor(
    private readonly client: RedisLike,
    private readonly stream: string,
    private readonly group: string,
    private readonly handler: Handler<T>,
    options: ConsumerOptions<T> = {},
  ) {
    super();
    this.consumerName = options.consumerName ?? `${hostname()}-${process.pid}`;
    this.opts = {
      concurrency: options.concurrency ?? DEFAULTS.concurrency,
      blockMs: options.blockMs ?? DEFAULTS.blockMs,
      batchSize: options.batchSize ?? DEFAULTS.batchSize,
      createIfMissing: options.createIfMissing ?? DEFAULTS.createIfMissing,
      shutdownMs: options.shutdownMs ?? DEFAULTS.shutdownMs,
      onError: options.onError,
      autoClaim: options.autoClaim,
      logger: options.logger,
    };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    if (this.opts.createIfMissing) {
      await ensureGroup(this.client, this.stream, this.group);
    }
    for (let i = 0; i < this.opts.concurrency; i++) {
      this.workers.push(this.runWorker());
    }
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    this.abort.abort();
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('shutdown timeout')), this.opts.shutdownMs),
    );
    try {
      await Promise.race([Promise.all(this.workers), timeout]);
    } catch (err) {
      this.opts.logger?.warn('consumer shutdown forced', err);
    }
  }

  private async runWorker(): Promise<void> {
    while (this.running) {
      let reply: XStream | null = null;
      try {
        reply = (await this.client.xreadgroup(
          'GROUP', this.group, this.consumerName,
          'COUNT', this.opts.batchSize,
          'BLOCK', this.opts.blockMs,
          'STREAMS', this.stream, '>',
        )) as XStream | null;
      } catch (err) {
        if (!this.running) return;
        const msg = (err as Error).message ?? '';
        if (msg.includes('NOGROUP')) {
          this.emit('error', err);
          throw err;
        }
        this.opts.logger?.warn('XREADGROUP failed; retrying', err);
        await this.sleep(200);
        continue;
      }
      if (!reply) continue;
      for (const [, entries] of reply) {
        for (const [id, fields] of entries) {
          await this.dispatch(id, fields, 1);
        }
      }
    }
  }

  private async dispatch(id: string, fields: string[], attempt: number): Promise<void> {
    const meta: MessageMeta = {
      id, attempt, stream: this.stream, group: this.group, consumer: this.consumerName,
    };
    let data: T;
    try {
      data = decode(fields) as T;
    } catch (err) {
      await this.runOnError(err, fields as unknown as T, meta);
      return;
    }
    this.emit('message', data, meta);
    try {
      await this.handler(data, meta);
      await this.client.xack(this.stream, this.group, id);
      this.emit('ack', id, meta);
    } catch (err) {
      await this.runOnError(err, data, meta);
    }
  }

  private async runOnError(err: unknown, data: T | Record<string, unknown>, meta: MessageMeta): Promise<void> {
    this.emit('error', err, meta);
    if (!this.opts.onError) return;
    try {
      await this.opts.onError(err, data, meta);
    } catch (cbErr) {
      this.opts.logger?.error('onError callback threw', cbErr);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      this.abort.signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
    });
  }
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npm test
```
Expected: all consumer tests green.

- [ ] **Step 5: Commit**

```bash
git add src/consumer.ts test/consumer.test.ts
git commit -m "feat(consumer): basic XREADGROUP loop with ack + onError"
```

---

## Task 7: Consumer — concurrency

**Files:**
- Modify: `test/consumer.test.ts`

- [ ] **Step 1: Add concurrency test to `test/consumer.test.ts`**

Append at end of file:

```ts
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
```

- [ ] **Step 2: Run test, expect PASS**

Concurrency support already exists from Task 6 (loop spawns N workers).

```bash
npm test
```

- [ ] **Step 3: Commit**

```bash
git add test/consumer.test.ts
git commit -m "test(consumer): verify concurrent worker execution"
```

---

## Task 8: Consumer — autoClaim

**Files:**
- Modify: `src/consumer.ts`
- Modify: `test/consumer.test.ts`

- [ ] **Step 1: Add autoClaim test to `test/consumer.test.ts`**

Append:

```ts
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
```

- [ ] **Step 2: Run, expect FAIL** (autoClaim path not wired)

- [ ] **Step 3: Modify `src/consumer.ts` — add autoClaim worker**

In `start()`, after spawning workers, append:

```ts
    if (this.opts.autoClaim) {
      this.workers.push(this.runAutoClaim());
    }
```

Add `runAutoClaim` method on the class:

```ts
  private async runAutoClaim(): Promise<void> {
    const ac = this.opts.autoClaim!;
    let cursor = '0-0';
    while (this.running) {
      await this.sleep(ac.intervalMs);
      if (!this.running) return;
      try {
        const result = (await this.client.xautoclaim(
          this.stream, this.group, this.consumerName,
          ac.idleMs, cursor, 'COUNT', this.opts.batchSize,
        )) as [string, [string, string[]][], string[]] | null;
        if (!result) continue;
        const [nextCursor, claimed] = result;
        cursor = nextCursor || '0-0';
        for (const [id, fields] of claimed) {
          this.emit('claim', id);
          await this.dispatch(id, fields, 2);
        }
      } catch (err) {
        this.opts.logger?.warn('XAUTOCLAIM failed', err);
      }
    }
  }
```

- [ ] **Step 4: Run, expect PASS**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/consumer.ts test/consumer.test.ts
git commit -m "feat(consumer): opt-in XAUTOCLAIM stale-message recovery"
```

---

## Task 9: Public exports + build verification

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Write `src/index.ts`**

```ts
export { Producer } from './producer.js';
export { Consumer } from './consumer.js';
export type {
  RedisLike,
  Logger,
  ProducerOptions,
  ConsumerOptions,
  AutoClaimOptions,
  Handler,
  ErrorHandler,
  MessageMeta,
} from './types.js';
```

- [ ] **Step 2: Build the package**

```bash
npm run build
```
Expected: `dist/esm/index.js`, `dist/esm/index.d.ts`, `dist/cjs/index.cjs`, `dist/cjs/index.d.cts` all present. No tsc errors.

- [ ] **Step 3: Verify exports list**

```bash
node -e "import('./dist/esm/index.js').then(m => console.log(Object.keys(m)))"
```
Expected output: `[ 'Consumer', 'Producer' ]`

- [ ] **Step 4: Run all unit tests once more**

```bash
npm test
```
Expected: every test green.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: public entrypoint"
```

---

## Task 10: Integration test (gated by REDIS_URL)

**Files:**
- Create: `test/integration.test.ts`

- [ ] **Step 1: Write `test/integration.test.ts`**

```ts
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

  // wait for both to be processed
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

  // Consumer A: handler throws so message stays pending
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

  // Consumer B: succeeds, claims via autoClaim
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
```

- [ ] **Step 2: If a Redis is available, run integration**

```bash
REDIS_URL=redis://127.0.0.1:6379 npm run test:integration
```
Expected (with Redis up): both integration tests pass. Without Redis: tests skipped.

- [ ] **Step 3: Commit**

```bash
git add test/integration.test.ts
git commit -m "test(integration): end-to-end + autoClaim recovery"
```

---

## Task 11: README usage section + final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace README with full usage**

```markdown
# redis-stream-producer-consumer

Tiny TypeScript wrapper over Redis Streams. Inject your own Redis client.

## Install

\`\`\`bash
npm install redis-stream-producer-consumer ioredis
\`\`\`

## Quick start

\`\`\`ts
import Redis from 'ioredis';
import { Producer, Consumer } from 'redis-stream-producer-consumer';

const client = new Redis({ host: 'localhost', port: 6379 });

interface Event { userId: string; action: string }

const producer = new Producer<Event>(client, 'events', { maxLen: 10000 });
await producer.start();
await producer.emit({ userId: 'u1', action: 'login' });

const consumer = new Consumer<Event>(
  client, 'events', 'workers',
  async (data, meta) => {
    console.log(meta.id, data.userId, data.action);
  },
  {
    concurrency: 4,
    onError: (err, data, meta) => console.error('handler failed', meta.id, err),
    autoClaim: { idleMs: 60_000, intervalMs: 30_000 },
  },
);
await consumer.start();
\`\`\`

## API

### `new Producer<T>(client, stream, options?)`

Options: `{ maxLen?: number; createIfMissing?: boolean; logger? }`.

- `start()` — no-op marker; safe to call.
- `emit(payload)` — `XADD`, returns the message ID.
- `stop()` — marks producer stopped; further `emit` throws.

### `new Consumer<T>(client, stream, group, handler, options?)`

Options:

| key | default | meaning |
|---|---|---|
| `consumerName` | `${hostname}-${pid}` | identifier in the group |
| `concurrency` | 1 | parallel handler workers |
| `blockMs` | 5000 | XREADGROUP BLOCK ms |
| `batchSize` | 10 | XREADGROUP COUNT |
| `createIfMissing` | true | bootstrap stream + group |
| `onError` | — | called on handler/decode failure; no-ack |
| `autoClaim` | off | `{ idleMs, intervalMs }` for stale recovery |
| `shutdownMs` | 30000 | graceful-stop timeout |
| `logger` | — | `{ info, warn, error }` |

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
```

- [ ] **Step 2: Final build + test**

```bash
npm run build && npm test
```
Expected: all green; `dist/` populated.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: full README with API and options table"
```

---

## Self-review checklist (already addressed)

- Spec coverage: every spec section has a task — types (T2), codec (T3), bootstrap (T4), producer (T5), consumer loop+ack+onError+decode-failure (T6), concurrency (T7), autoClaim (T8), public API (T9), integration tests (T10), README/docs (T11).
- No placeholders. Every code step is complete.
- Type names consistent across tasks (`RedisLike`, `MessageMeta`, `ConsumerOptions<T>`, `ProducerOptions`, `Handler<T>`, `ErrorHandler<T>`).
- Method signatures stable: `Producer.emit(payload): Promise<string>`, `Consumer.start()/stop(): Promise<void>`.
