export type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
  keyExtractor: (req: { ip?: string; headers?: Record<string, string> }) => string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  key: string,
  config: Pick<RateLimitConfig, "maxRequests" | "windowMs">,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

export function rateLimitHeaders(result: {
  remaining: number;
  resetAt: number;
}): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

export function cleanupExpiredEntries(): number {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
      cleaned++;
    }
  }
  return cleaned;
}

export const ROUTE_LIMITS: Record<string, Pick<RateLimitConfig, "maxRequests" | "windowMs">> = {
  "auth": { maxRequests: 10, windowMs: 60_000 },
  "cart": { maxRequests: 30, windowMs: 60_000 },
  "reviews": { maxRequests: 5, windowMs: 300_000 },
  "forms": { maxRequests: 10, windowMs: 300_000 },
  "shop": { maxRequests: 60, windowMs: 60_000 },
  "webhooks": { maxRequests: 100, windowMs: 60_000 },
  "admin": { maxRequests: 60, windowMs: 60_000 },
};
