import type { RedisLike } from './types.js';

export async function ensureGroup(
  client: RedisLike,
  stream: string,
  group: string,
): Promise<void> {
  try {
    await client.xgroup('CREATE', stream, group, '$', 'MKSTREAM');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('BUSYGROUP')) return;
    throw err;
  }
}
