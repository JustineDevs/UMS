import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "./route";

test("SOP health fails closed when Worker readiness is unavailable", async () => {
  const previous = {
    apiUrl: process.env.API_URL,
    projectToken: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
    apiKey: process.env.POSTHOG_API_KEY,
  };
  const originalFetch = globalThis.fetch;
  process.env.API_URL = "https://worker.test";
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "ph_project";
  process.env.POSTHOG_API_KEY = "phc_api";
  globalThis.fetch = (async () => new Response(JSON.stringify({ status: "not_ready" }), { status: 503 })) as typeof fetch;

  try {
    const response = await GET();
    assert.equal(response.status, 503);
    const body = (await response.json()) as { status: string; worker: { readyReachable: boolean }; deployment: { commitSha: string } };
    assert.equal(body.status, "degraded");
    assert.equal(body.worker.readyReachable, false);
    assert.equal(body.deployment.commitSha, "unknown");
  } finally {
    if (previous.apiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previous.apiUrl;
    if (previous.projectToken === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    else process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = previous.projectToken;
    if (previous.apiKey === undefined) delete process.env.POSTHOG_API_KEY;
    else process.env.POSTHOG_API_KEY = previous.apiKey;
    globalThis.fetch = originalFetch;
  }
});

test("SOP health returns ready only when Worker readiness succeeds", async () => {
  const previous = {
    apiUrl: process.env.API_URL,
    projectToken: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
    apiKey: process.env.POSTHOG_API_KEY,
  };
  const originalFetch = globalThis.fetch;
  process.env.API_URL = "https://worker.test";
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "ph_project";
  process.env.POSTHOG_API_KEY = "phc_api";
  let target = "";
  globalThis.fetch = (async (input) => {
    target = String(input);
    return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
  }) as typeof fetch;

  try {
    const response = await GET();
    assert.equal(response.status, 200);
    const body = (await response.json()) as { status: string; worker: { readyReachable: boolean }; deployment: { commitSha: string } };
    assert.equal(body.status, "ok");
    assert.equal(body.worker.readyReachable, true);
    assert.equal(body.deployment.commitSha, "unknown");
    assert.equal(target, "https://worker.test/readyz");
  } finally {
    if (previous.apiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previous.apiUrl;
    if (previous.projectToken === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    else process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = previous.projectToken;
    if (previous.apiKey === undefined) delete process.env.POSTHOG_API_KEY;
    else process.env.POSTHOG_API_KEY = previous.apiKey;
    globalThis.fetch = originalFetch;
  }
});
