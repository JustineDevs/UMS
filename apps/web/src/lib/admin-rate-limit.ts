import { readResponseJson } from "./read-response-json";

type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };

type Bucket = { count: number; resetAt: number };
const localBuckets = new Map<string, Bucket>();
export const MAX_LOCAL_BUCKETS = 10_000;

function localRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const current = localBuckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;
  bucket.count += 1;
  localBuckets.set(key, bucket);
  if (localBuckets.size > MAX_LOCAL_BUCKETS) {
    for (const [entryKey, entry] of localBuckets) {
      if (entry.resetAt <= now) localBuckets.delete(entryKey);
    }
    while (localBuckets.size > MAX_LOCAL_BUCKETS) {
      const oldestKey = localBuckets.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      localBuckets.delete(oldestKey);
    }
  }
  return { allowed: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count), resetAt: bucket.resetAt };
}

export function getLocalAdminRateLimitBucketCount(): number {
  return localBuckets.size;
}

function failClosedRateLimit(windowSeconds: number): RateLimitResult {
  return { allowed: false, remaining: 0, resetAt: Date.now() + windowSeconds * 1000 };
}

/** Uses Upstash REST when configured; bounded memory is only a development fallback. */
export async function checkAdminRateLimit(
  key: string,
  limit = 60,
  windowSeconds = 60,
): Promise<RateLimitResult> {
  // Local browser verification must not share production's Upstash bucket.
  // A stale/shared development identity would otherwise make destructive local
  // admin checks appear broken with a 429 before the route is reached.
  // The local production build is used for browser verification, but it must
  // not consume the shared production bucket. Keep the opt-out explicit so a
  // real production deployment still fails closed when Upstash is unavailable.
  const useRemoteLimiter =
    process.env.NODE_ENV === "production" &&
    process.env.UVS_E2E_LOCAL !== "1" &&
    process.env.UVS_E2E_REAL_SESSION !== "1";
  const url = useRemoteLimiter ? process.env.UPSTASH_REDIS_REST_URL?.trim() : undefined;
  const token = useRemoteLimiter ? process.env.UPSTASH_REDIS_REST_TOKEN?.trim() : undefined;
  if (!url || !token) {
    return useRemoteLimiter
      ? failClosedRateLimit(windowSeconds)
      : localRateLimit(key, limit, windowSeconds * 1000);
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 2_000);
    const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", `admin:rate:${key}`],
        ["EXPIRE", `admin:rate:${key}`, windowSeconds],
      ]),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return failClosedRateLimit(windowSeconds);
    const result = await readResponseJson<Array<{ result?: number }>>(response, []);
    const count = Number(result?.[0]?.result ?? limit + 1);
    const resetAt = Date.now() + windowSeconds * 1000;
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt };
  } catch {
    // A per-isolate fallback is not a security boundary in production: it
    // allows traffic to bypass the intended shared limiter during an outage.
    return failClosedRateLimit(windowSeconds);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
