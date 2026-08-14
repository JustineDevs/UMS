/**
 * Rate limits for public Route Handlers.
 * When UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set, limits use
 * Upstash Redis REST (shared across instances). Otherwise a fixed window
 * in-process map is used.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 50_000;

function pruneIfNeeded(): void {
  if (buckets.size <= MAX_BUCKETS) return;
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (now > b.resetAt) buckets.delete(k);
    if (buckets.size <= MAX_BUCKETS * 0.8) break;
  }
}

function rateLimitInProcess(
  key: string,
  max: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  pruneIfNeeded();
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (b.count >= max) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }
  b.count += 1;
  return { ok: true };
}

/**
 * Upstash Redis REST returns JSON `{ "result": number }` (or legacy plain number string).
 */
export function parseUpstashRestNumber(body: string): number | null {
  const t = body.trim();
  if (!t) return null;
  if (t.startsWith("{")) {
    try {
      const j = JSON.parse(t) as { result?: unknown };
      const r = j.result;
      if (typeof r === "number" && Number.isFinite(r)) return r;
      if (typeof r === "string") {
        const n = Number(r);
        return Number.isFinite(n) ? n : null;
      }
      return null;
    } catch {
      return null;
    }
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

async function rateLimitUpstash(
  key: string,
  max: number,
  windowMs: number,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number } | null> {
  const base = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!base || !token) return null;
  const root = base.replace(/\/$/, "");
  const k = encodeURIComponent(`sf:rl:${key}`);
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const auth = { Authorization: `Bearer ${token}` };

  const signal = AbortSignal.timeout(2_000);
  const incrRes = await fetch(`${root}/incr/${k}`, { headers: auth, signal });
  if (!incrRes.ok) return null;
  const count = parseUpstashRestNumber(await incrRes.text());
  if (count === null) return null;
  if (count === 1) {
    await fetch(`${root}/expire/${k}/${windowSec}`, { headers: auth, signal });
  }
  if (count > max) {
    const ttlRes = await fetch(`${root}/ttl/${k}`, { headers: auth, signal });
    const ttlParsed = ttlRes.ok
      ? parseUpstashRestNumber(await ttlRes.text())
      : null;
    const ttlRaw = ttlParsed !== null ? ttlParsed : -1;
    const ttl = Number.isFinite(ttlRaw) && ttlRaw > 0 ? ttlRaw : windowSec;
    return { ok: false, retryAfterSec: Math.max(1, ttl) };
  }
  return { ok: true };
}

/** Sticky backend: avoid mixing Upstash and in-process for the same key in one process (would reset counts). */
let useUpstashForRateLimit: boolean | null = null;

function upstashEnvConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

/**
 * Fixed-window limit. Uses Upstash when configured; otherwise in-process.
 * If Upstash is configured but a call returns null (HTTP/parse failure), subsequent calls use in-process only.
 */
export async function rateLimitFixedWindow(
  key: string,
  max: number,
  windowMs: number,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  if (useUpstashForRateLimit === null) {
    useUpstashForRateLimit = upstashEnvConfigured();
  }
  if (useUpstashForRateLimit) {
    try {
      const remote = await rateLimitUpstash(key, max, windowMs);
      if (remote !== null) {
        return remote;
      }
    } catch {
      // A remote limiter outage must not strand public checkout routes.
    }
    useUpstashForRateLimit = false;
  }
  return rateLimitInProcess(key, max, windowMs);
}

export function getRequestIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf.slice(0, 128);
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 128);
  return "unknown";
}
