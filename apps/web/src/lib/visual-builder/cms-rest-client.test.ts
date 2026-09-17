import assert from "node:assert/strict";
import test from "node:test";
import { UvsCmsClient } from "./cms-rest-client";

function response(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }

test("typed CMS client sends tenant-session credentials, version, and replay key", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const client = new UvsCmsClient(async (input, init) => { calls.push({ url: String(input), init }); return response({ id: "p1", slug: "home", title: "Home" }); }, "https://admin.test");
  const saved = await client.savePage("p1", { blocks: [] }, 3, "replay-1");
  assert.equal(saved.data.id, "p1"); assert.equal(calls[0].init?.headers && (calls[0].init.headers as Record<string, string>)["if-match"], "3"); assert.equal((calls[0].init?.headers as Record<string, string>)["idempotency-key"], "replay-1");
});
