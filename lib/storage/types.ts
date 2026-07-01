// Backend-agnostic storage contract. Application code depends only on this,
// never on a concrete Redis client. Two adapters implement it: Upstash REST
// (serverless / Vercel) and the official `redis` package (self-host / Docker).
//
// Values are JSON-encoded on write and JSON-decoded on read by every adapter,
// so both backends behave identically (arrays, strings, etc. all round-trip).

export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  setWithTTL(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Remaining TTL in seconds. Redis semantics: -1 = no expiry, -2 = missing. */
  ttl(key: string): Promise<number>;
  /** SET key value NX EX ttl — returns true if the lock was acquired. */
  acquireLock(key: string, ttlSeconds: number): Promise<boolean>;
}

/** Encode any value to the string actually stored in Redis. */
export function encode(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Decode a stored string. Falls back to the raw string if it isn't valid JSON
 * so a hypothetical legacy plain-string value never reads back as null.
 */
export function decode<T>(raw: string | null): T | null {
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}
