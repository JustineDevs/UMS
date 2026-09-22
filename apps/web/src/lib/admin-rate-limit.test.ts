import assert from "node:assert/strict";
import test from "node:test";

import {
  checkAdminRateLimit,
  getLocalAdminRateLimitBucketCount,
  MAX_LOCAL_BUCKETS,
} from "./admin-rate-limit";

const env = process.env as Record<string, string | undefined>;

async function withRemoteLimiter<T>(fetchImpl: typeof fetch, run: () => Promise<T>): Promise<T> {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  env.NODE_ENV = "production";
  env.UPSTASH_REDIS_REST_URL = "https://redis.example.test";
  env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = originalNodeEnv;
    if (originalUrl === undefined) delete env.UPSTASH_REDIS_REST_URL;
    else env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete env.UPSTASH_REDIS_REST_TOKEN;
    else env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }
}

async function assertRemoteTimeoutIsCleared(fetchImpl: typeof fetch): Promise<void> {
  const originalClearTimeout = globalThis.clearTimeout;
  let clearCalls = 0;
  globalThis.clearTimeout = ((handle: ReturnType<typeof setTimeout>) => {
    clearCalls += 1;
    return originalClearTimeout(handle);
  }) as typeof clearTimeout;
  try {
    await withRemoteLimiter(fetchImpl, () => checkAdminRateLimit(`timeout-${Math.random()}`, 60, 60));
    assert.equal(clearCalls, 1);
  } finally {
    globalThis.clearTimeout = originalClearTimeout;
  }
}

test("admin rate-limit clears the timeout after a successful remote response", async () => {
  await assertRemoteTimeoutIsCleared(async () =>
    new Response(JSON.stringify([{ result: 1 }, { result: 60 }]), { status: 200 }),
  );
});

test("admin rate-limit clears the timeout after a remote HTTP failure", async () => {
  await assertRemoteTimeoutIsCleared(async () => new Response("unavailable", { status: 503 }));
});

test("admin rate-limit clears the timeout after a remote fetch failure", async () => {
  await assertRemoteTimeoutIsCleared(async () => {
    throw new Error("network unavailable");
  });
});

test("production admin rate-limit fails closed when Upstash is not configured", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete env.UPSTASH_REDIS_REST_URL;
  delete env.UPSTASH_REDIS_REST_TOKEN;
  env.NODE_ENV = "production";
  try {
    const result = await checkAdminRateLimit("missing-upstash", 60, 60);
    assert.equal(result.allowed, false);
    assert.equal(result.remaining, 0);
  } finally {
    if (originalNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = originalNodeEnv;
    if (originalUrl === undefined) delete env.UPSTASH_REDIS_REST_URL;
    else env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete env.UPSTASH_REDIS_REST_TOKEN;
    else env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }
});

test("local admin rate-limit evicts oldest active buckets at its hard cap", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete env.NODE_ENV;
  delete env.UPSTASH_REDIS_REST_URL;
  delete env.UPSTASH_REDIS_REST_TOKEN;
  try {
    for (let index = 0; index <= MAX_LOCAL_BUCKETS; index += 1) {
      await checkAdminRateLimit(`active-bucket-${index}`, 60, 60);
    }
    assert.ok(getLocalAdminRateLimitBucketCount() <= MAX_LOCAL_BUCKETS);
  } finally {
    if (originalNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = originalNodeEnv;
    if (originalUrl === undefined) delete env.UPSTASH_REDIS_REST_URL;
    else env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete env.UPSTASH_REDIS_REST_TOKEN;
    else env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }
});
