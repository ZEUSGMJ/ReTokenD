import { Redis } from "@upstash/redis";

// IMPORTANT: the Vercel Marketplace Upstash integration injects
// KV_REST_API_URL / KV_REST_API_TOKEN, which Redis.fromEnv() does NOT read
// by default (it looks for UPSTASH_REDIS_REST_URL / _TOKEN). Construct
// explicitly so this works with the Vercel-provisioned env vars.
const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;
if (!url || !token) {
  throw new Error("KV_REST_API_URL / KV_REST_API_TOKEN are not set");
}

export const redis = new Redis({ url, token });
