import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "./route";

test("search suggestions expand catalog queries, deduplicate, rank, and normalize prices", async () => {
  const previousApiUrl = process.env.API_URL;
  const previousDisableRemoteRateLimit = process.env.UVS_DISABLE_REMOTE_RATE_LIMIT;
  const originalFetch = globalThis.fetch;
  process.env.API_URL = "https://worker.test/";
  process.env.UVS_DISABLE_REMOTE_RATE_LIMIT = "1";
  const requests: string[] = [];
  globalThis.fetch = (async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.includes("q=amp")) {
      return Response.json({
        suggestions: [
          { slug: "electric-amplifier", name: "Electric Amplifier", minPrice: 125000 },
          { slug: "amplifier", name: "Amplifier", minPrice: 99000 },
        ],
      });
    }
    return Response.json({
      suggestions: [
        { slug: "amplifier", name: "Amplifier", minPrice: 99000 },
        { slug: "bass-guitar", name: "Bass Guitar", minPrice: "not-a-number" },
      ],
    });
  }) as typeof fetch;

  try {
    const response = await GET(new Request("https://shop.test/api/shop/search-suggest?q=amp", {
      headers: { "x-forwarded-for": "198.51.100.10" },
    }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "public, max-age=5, s-maxage=60, stale-while-revalidate=300");
    assert.deepEqual(await response.json(), {
      suggestions: [
        { slug: "amplifier", name: "Amplifier", minPrice: 990, },
        { slug: "electric-amplifier", name: "Electric Amplifier", minPrice: 1250, },
      ],
    });
    assert.deepEqual(requests, [
      "https://worker.test/store/search/suggestions?q=amp",
      "https://worker.test/store/search/suggestions?q=amplifier",
    ]);
  } finally {
    if (previousApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousApiUrl;
    if (previousDisableRemoteRateLimit === undefined) delete process.env.UVS_DISABLE_REMOTE_RATE_LIMIT;
    else process.env.UVS_DISABLE_REMOTE_RATE_LIMIT = previousDisableRemoteRateLimit;
    globalThis.fetch = originalFetch;
  }
});

test("search suggestions fail closed when the catalog boundary is unavailable", async () => {
  const previousApiUrl = process.env.API_URL;
  process.env.API_URL = "https://worker.test";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("upstream unavailable", { status: 503 })) as typeof fetch;
  try {
    const response = await GET(new Request("https://shop.test/api/shop/search-suggest?q=guitar", {
      headers: { "cf-connecting-ip": "198.51.100.11" },
    }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { suggestions: [], error: "catalog_unavailable" });
  } finally {
    if (previousApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousApiUrl;
    globalThis.fetch = originalFetch;
  }
});
