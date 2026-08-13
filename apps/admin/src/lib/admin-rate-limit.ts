type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };

type Bucket = { count: number; resetAt: number };
const localBuckets = new Map<string, Bucket>();
const MAX_LOCAL_BUCKETS = 10_000;

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
  }
  return { allowed: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count), resetAt: bucket.resetAt };
}

/** Uses Upstash REST when configured; bounded memory is only a development fallback. */
export async function checkAdminRateLimit(
  key: string,
  limit = 60,
  windowSeconds = 60,
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return localRateLimit(key, limit, windowSeconds * 1000);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_000);
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
    clearTimeout(timeout);
    if (!response.ok) return localRateLimit(key, limit, windowSeconds * 1000);
    const result = (await response.json()) as Array<{ result?: number }>;
    const count = Number(result?.[0]?.result ?? limit + 1);
    const resetAt = Date.now() + windowSeconds * 1000;
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt };
  } catch {
    return localRateLimit(key, limit, windowSeconds * 1000);
  }
}
