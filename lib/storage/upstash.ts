import { Redis } from "@upstash/redis";
import { decode, encode, type StorageAdapter } from "@/lib/storage/types";

// Upstash REST adapter (serverless). Manual JSON encoding keeps the wire
// format identical to the node-redis adapter.
export function createUpstashAdapter(url: string, token: string): StorageAdapter {
  const redis = new Redis({ url, token, automaticDeserialization: false });

  return {
    async get<T>(key: string): Promise<T | null> {
      const raw = await redis.get<string>(key);
      return decode<T>(raw ?? null);
    },
    async set(key: string, value: unknown): Promise<void> {
      await redis.set(key, encode(value));
    },
    async setWithTTL(key: string, value: unknown, ttlSeconds: number): Promise<void> {
      await redis.set(key, encode(value), { ex: ttlSeconds });
    },
    async del(...keys: string[]): Promise<void> {
      if (keys.length > 0) await redis.del(...keys);
    },
    async exists(key: string): Promise<boolean> {
      return (await redis.exists(key)) > 0;
    },
    async ttl(key: string): Promise<number> {
      return redis.ttl(key);
    },
    async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
      const res = await redis.set(key, encode("1"), { nx: true, ex: ttlSeconds });
      return res === "OK";
    },
  };
}
