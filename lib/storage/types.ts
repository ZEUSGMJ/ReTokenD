// Backend-agnostic storage contract. Values JSON round-trip identically in
// both adapters (Upstash REST, node-redis).

export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  setWithTTL(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
  /** Atomic INCR; sets the expiry window only when the key is newly created. */
  incr(key: string, windowSeconds: number): Promise<number>;
  /** SET key owner NX EX ttl — returns true if the lock was acquired. */
  acquireLock(key: string, owner: string, ttlSeconds: number): Promise<boolean>;
  /** Deletes the lock only while its owner value still matches. */
  releaseLock(key: string, owner: string): Promise<boolean>;
}

export const RELEASE_LOCK_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

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
