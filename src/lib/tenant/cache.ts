import 'server-only';
import { Redis } from '@upstash/redis';
import { env } from '@/lib/env';

let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (redis) return redis;
  const url = env.upstash.url();
  const token = env.upstash.token();
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

const memCache = new Map<string, { value: string | null; expires: number }>();
const TTL_MS = 5 * 60 * 1000;

export async function cacheGet(key: string): Promise<string | null | undefined> {
  const r = getRedis();
  if (r) {
    const v = await r.get<string>(key);
    return v ?? null;
  }
  const hit = memCache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    memCache.delete(key);
    return undefined;
  }
  return hit.value;
}

export async function cacheSet(key: string, value: string | null) {
  const r = getRedis();
  if (r) {
    if (value === null) await r.set(key, '__null__', { ex: 60 });
    else await r.set(key, value, { ex: 300 });
    return;
  }
  memCache.set(key, { value, expires: Date.now() + TTL_MS });
}
