// Backend-agnostic storage contract. Values JSON round-trip identically in
// both adapters (Upstash REST, node-redis).

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

export function encode(value: unknown): string {
  return JSON.stringify(value);
}

/** Non-JSON values fall back to the raw string. */
export function decode<T>(raw: string | null): T | null {
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}
