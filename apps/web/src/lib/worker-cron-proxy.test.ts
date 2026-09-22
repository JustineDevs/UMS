import assert from "node:assert/strict";
import test from "node:test";
import { proxyCronToWorker } from "./worker-cron-proxy";

test("Worker cron proxy rejects unauthenticated requests before forwarding", async () => {
  const previousApiUrl = process.env.API_URL;
  const originalFetch = globalThis.fetch;
  process.env.API_URL = "https://worker.test";
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return Response.json({ ok: true });
  }) as typeof fetch;
  try {
    const response = await proxyCronToWorker(
      new Request("https://shop.test/api/cron/back-in-stock"),
      "back-in-stock",
    );
    assert.equal(response.status, 401);
    assert.equal(called, false);
  } finally {
    if (previousApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousApiUrl;
    globalThis.fetch = originalFetch;
  }
});

test("Worker cron proxy forwards only the authenticated scheduled-job credential", async () => {
  const previousApiUrl = process.env.API_URL;
  const originalFetch = globalThis.fetch;
  process.env.API_URL = "https://worker.test/";
  let targetUrl = "";
  let targetInit: RequestInit | undefined;
  globalThis.fetch = (async (input, init) => {
    targetUrl = String(input);
    targetInit = init;
    return Response.json({ ok: true });
  }) as typeof fetch;
  try {
    const response = await proxyCronToWorker(
      new Request("https://shop.test/api/cron/back-in-stock", {
        headers: { "x-cron-secret": "scheduled-secret", Cookie: "session=private" },
      }),
      "back-in-stock",
    );
    assert.equal(response.status, 200);
    assert.equal(targetUrl, "https://worker.test/internal/cron/back-in-stock");
    const headers = new Headers(targetInit?.headers);
    assert.equal(headers.get("x-cron-secret"), "scheduled-secret");
    assert.equal(headers.get("cookie"), null);
  } finally {
    if (previousApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousApiUrl;
    globalThis.fetch = originalFetch;
  }
});
