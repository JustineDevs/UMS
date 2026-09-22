import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleAdminPromotionCodesRequest } from "./promotions.ts";

function b64(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function token(claims: Record<string, unknown>): Promise<string> {
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({ sub: "staff_1", exp: 2_000_000_000, ...claims });
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("promotion-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`)));
  return `${header}.${payload}.${btoa(String.fromCharCode(...signature)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`;
}

function makeDatabase(codes: string[], onQuery: (_sql: string) => void): WorkerDatabaseClient {
  return {
    async query<T extends Record<string, unknown>>(sql: string) {
      onQuery(sql);
      return { rows: codes.map((code) => ({ code })) as T[], rowCount: codes.length };
    },
    async end() {},
  };
}

test("promotion codes reject unauthenticated callers before database access", async () => {
  let queried = false;
  const response = await handleAdminPromotionCodesRequest(
    new Request("https://worker.test/api/admin/promotions/codes"),
    makeDatabase([], () => { queried = true; }),
    { JWT_SECRET: "promotion-secret" },
  );

  assert.equal(response.status, 401);
  assert.equal(queried, false);
});

test("promotion codes require campaign or promotion read permission", async () => {
  const response = await handleAdminPromotionCodesRequest(
    new Request("https://worker.test/api/admin/promotions/codes", {
      headers: { Authorization: `Bearer ${await token({ role: "staff", permissions: ["orders:read"] })}` },
    }),
    makeDatabase([], () => {}),
    { JWT_SECRET: "promotion-secret" },
  );

  assert.equal(response.status, 401);
});

test("promotion codes expose only active, normalized commerce codes to authorized campaign staff", async () => {
  let queriedSql = "";
  const response = await handleAdminPromotionCodesRequest(
    new Request("https://worker.test/api/admin/promotions/codes", {
      headers: { Authorization: `Bearer ${await token({ role: "staff", permissions: ["campaigns:execute"] })}` },
    }),
    makeDatabase(["SAVE20", "WELCOME"], (sql) => { queriedSql = sql; }),
    { JWT_SECRET: "promotion-secret" },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { codes: ["SAVE20", "WELCOME"], count: 2 });
  assert.match(queriedSql, /deleted_at IS NULL/);
  assert.match(queriedSql, /status = 'active'/);
  assert.match(queriedSql, /LIMIT 1000/);
});

test("promotion codes reject mutation methods", async () => {
  const response = await handleAdminPromotionCodesRequest(
    new Request("https://worker.test/api/admin/promotions/codes", { method: "POST" }),
    makeDatabase([], () => {}),
    { JWT_SECRET: "promotion-secret" },
  );

  assert.equal(response.status, 405);
});
