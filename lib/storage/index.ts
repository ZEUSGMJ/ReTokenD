import type { StorageAdapter } from "@/lib/storage/types";
import { createUpstashAdapter } from "@/lib/storage/upstash";
import { createNodeRedisAdapter } from "@/lib/storage/node-redis";

// Backend selection. Precedence:
//   1. REDIS_URL            -> local / self-hosted Redis (node-redis)
//   2. KV_REST_API_*        -> Upstash REST (serverless / Vercel)
//   3. throw                -> misconfigured deployment
// The rest of the app imports `storage` and never knows which backend is live.
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

// Resolve lazily on first use, not at import time, so `next build` (which has
// no secrets) never trips the "no backend configured" error just by bundling.
let adapter: StorageAdapter | null = null;
function getAdapter(): StorageAdapter {
  return (adapter ??= selectAdapter());
}

export const storage: StorageAdapter = {
  get: <T>(key: string) => getAdapter().get<T>(key),
  set: (key, value) => getAdapter().set(key, value),
  setWithTTL: (key, value, ttlSeconds) => getAdapter().setWithTTL(key, value, ttlSeconds),
  del: (...keys) => getAdapter().del(...keys),
  exists: (key) => getAdapter().exists(key),
  ttl: (key) => getAdapter().ttl(key),
  acquireLock: (key, ttlSeconds) => getAdapter().acquireLock(key, ttlSeconds),
};

export type { StorageAdapter } from "@/lib/storage/types";
