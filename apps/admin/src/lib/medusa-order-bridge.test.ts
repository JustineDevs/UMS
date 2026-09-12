import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchMedusaOrdersForAdmin } from "./medusa-order-bridge";

test("marks non-2xx Medusa order responses as unavailable", async () => {
  const originalFetch = globalThis.fetch;
  const originalBackend = process.env.MEDUSA_BACKEND_URL;
  const originalSecret = process.env.MEDUSA_SECRET_API_KEY;
  process.env.MEDUSA_BACKEND_URL = "https://medusa.example.test";
  process.env.MEDUSA_SECRET_API_KEY = "test-secret";
  globalThis.fetch = async () => new Response("gateway unavailable", { status: 503 });

  try {
    assert.deepEqual(await fetchMedusaOrdersForAdmin(10), {
      orders: [],
      total: 0,
      commerceUnavailable: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBackend === undefined) delete process.env.MEDUSA_BACKEND_URL;
    else process.env.MEDUSA_BACKEND_URL = originalBackend;
    if (originalSecret === undefined) delete process.env.MEDUSA_SECRET_API_KEY;
    else process.env.MEDUSA_SECRET_API_KEY = originalSecret;
  }
});
