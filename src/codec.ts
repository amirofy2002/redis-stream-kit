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
