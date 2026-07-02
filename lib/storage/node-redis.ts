import { createClient, type RedisClientType } from "redis";
import { decode, encode, type StorageAdapter } from "@/lib/storage/types";

// node-redis adapter (self-host). One lazy connection, cached on globalThis
// to survive dev hot-reload. Never selected on serverless.

const globalForRedis = globalThis as unknown as {
  __retokendRedisClient?: RedisClientType;
  __retokendRedisConnect?: Promise<RedisClientType>;
};

function getClient(url: string): Promise<RedisClientType> {
  if (globalForRedis.__retokendRedisConnect) {
    return globalForRedis.__retokendRedisConnect;
  }

  const client: RedisClientType = createClient({
    url,
    socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 3000) },
  });
  client.on("error", (err) => console.error("node-redis client error", err));
  globalForRedis.__retokendRedisClient = client;

  globalForRedis.__retokendRedisConnect = client.connect().then(() => client);
  return globalForRedis.__retokendRedisConnect;
}

export function createNodeRedisAdapter(url: string): StorageAdapter {
  return {
    async get<T>(key: string): Promise<T | null> {
      const client = await getClient(url);
      return decode<T>(await client.get(key));
    },
    async set(key: string, value: unknown): Promise<void> {
      const client = await getClient(url);
      await client.set(key, encode(value));
    },
    async setWithTTL(key: string, value: unknown, ttlSeconds: number): Promise<void> {
      const client = await getClient(url);
      await client.set(key, encode(value), { EX: ttlSeconds });
    },
    async del(...keys: string[]): Promise<void> {
      if (keys.length === 0) return;
      const client = await getClient(url);
      await client.del(keys);
    },
    async exists(key: string): Promise<boolean> {
      const client = await getClient(url);
      return (await client.exists(key)) > 0;
    },
    async ttl(key: string): Promise<number> {
      const client = await getClient(url);
      return client.ttl(key);
    },
    async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
      const client = await getClient(url);
      const res = await client.set(key, encode("1"), { NX: true, EX: ttlSeconds });
      return res === "OK";
    },
  };
}
