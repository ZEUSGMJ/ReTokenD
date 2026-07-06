import type { StorageAdapter } from "@/lib/storage/types";
import { createUpstashAdapter } from "@/lib/storage/upstash";
import { createNodeRedisAdapter } from "@/lib/storage/node-redis";

// Backend precedence: REDIS_URL > KV_REST_API_* (Upstash) > throw.
function selectAdapter(): StorageAdapter {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    return createNodeRedisAdapter(redisUrl);
  }

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) {
    return createUpstashAdapter(url, token);
  }

  throw new Error(
    "No storage backend configured: set REDIS_URL (local Redis) or KV_REST_API_URL / KV_REST_API_TOKEN (Upstash)."
  );
}

// lazy so `next build` (no secrets) doesn't throw at import time
let adapter: StorageAdapter | null = null;
function getAdapter(): StorageAdapter {
  return (adapter ??= selectAdapter());
}

export const storage: StorageAdapter = {
  get: <T>(key: string) => getAdapter().get<T>(key),
  set: (key, value) => getAdapter().set(key, value),
  setWithTTL: (key, value, ttlSeconds) => getAdapter().setWithTTL(key, value, ttlSeconds),
  del: (...keys) => getAdapter().del(...keys),
  incr: (key, windowSeconds) => getAdapter().incr(key, windowSeconds),
  acquireLock: (key, ttlSeconds) => getAdapter().acquireLock(key, ttlSeconds),
};

export type { StorageAdapter } from "@/lib/storage/types";
