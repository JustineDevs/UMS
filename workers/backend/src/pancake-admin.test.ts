import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { handleAdminPancakeIntegrationRequest } from "./pancake-admin.ts";

function jwt(role = "admin", permissions: string[] = [], organization = "org-1"): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "staff-1", ...(organization ? { org_id: organization } : {}), role, permissions, exp: Math.floor(Date.now() / 1000) + 300 });
  return `${header}.${payload}.${createHmac("sha256", "worker-secret").update(`${header}.${payload}`).digest("base64url")}`;
}
const database = { query: async () => ({ rows: [], rowCount: 0 }), end: async () => undefined };

test("Pancake integration requires authenticated staff with settings permission", async () => {
  const request = (authorization?: string) => new Request("https://api.test/api/admin/integrations/pancake", { headers: authorization ? { Authorization: authorization } : {} });
  assert.equal((await handleAdminPancakeIntegrationRequest(request(), database, { CMS_ADMIN_JWT_SECRET: "worker-secret" })).status, 401);
  const denied = await handleAdminPancakeIntegrationRequest(request(`Bearer ${jwt("staff", ["catalog:read"])}`), database, { CMS_ADMIN_JWT_SECRET: "worker-secret" });
  assert.equal(denied.status, 403);
  const tenantless = await handleAdminPancakeIntegrationRequest(request(`Bearer ${jwt("admin", [], "")}`), database, { CMS_ADMIN_JWT_SECRET: "worker-secret" });
  assert.equal(tenantless.status, 403);
  assert.equal((await tenantless.json() as { error: string }).error, "organization_claim_required");
});

test("Pancake shop reads stay in Worker and normalize the provider response", async () => {
  let calledUrl = "";
  const response = await handleAdminPancakeIntegrationRequest(
    new Request("https://api.test/api/admin/integrations/pancake?resource=shops", { headers: { Authorization: `Bearer ${jwt()}` } }),
    database,
    { CMS_ADMIN_JWT_SECRET: "worker-secret", PANCAKE_POS_API_KEY: "secret", fetch: async (input) => { calledUrl = String(input); return Response.json({ shops: [{ id: 7, name: "Store", avatar_url: "https://img.test/a.png", pages: [{ id: 9, name: "Page", settings: { auto_create_order: true } }] }] }); } },
  );
  const body = await response.json() as { data: Array<{ id: number; pages: Array<{ autoCreateOrder: boolean }> }> };
  assert.equal(response.status, 200);
  assert.equal(new URL(calledUrl).hostname, "pos.pages.fm");
  assert.equal(new URL(calledUrl).searchParams.get("api_key"), "secret");
  assert.deepEqual(body.data[0], { id: 7, name: "Store", avatarUrl: "https://img.test/a.png", pages: [{ id: "9", name: "Page", platform: null, autoCreateOrder: true }] });
  assert.ok(!JSON.stringify(body).includes("secret"));
});

test("Pancake resource proxy encodes shop IDs, bounds query values, and never follows redirects", async () => {
  let calledUrl = "";
  let redirectMode = "";
  const response = await handleAdminPancakeIntegrationRequest(
    new Request("https://api.test/api/admin/integrations/pancake?resource=orders&shopId=a%2Fb&limit=1000&offset=-5&api_key=attacker", { headers: { Authorization: `Bearer ${jwt()}` } }),
    database,
    { CMS_ADMIN_JWT_SECRET: "worker-secret", PANCAKE_POS_API_KEY: "worker-key", fetch: async (input, init) => { calledUrl = String(input); redirectMode = String(init?.redirect); return Response.json({ orders: [] }); } },
  );
  const upstream = new URL(calledUrl);
  assert.equal(response.status, 200);
  assert.equal(upstream.pathname, "/api/v1/shops/a%2Fb/orders");
  assert.equal(upstream.searchParams.get("limit"), "100");
  assert.equal(upstream.searchParams.get("offset"), "0");
  assert.equal(upstream.searchParams.get("api_key"), "worker-key");
  assert.equal(redirectMode, "error");
});

test("Pancake proxy rejects unsupported resources and unsafe base URLs", async () => {
  const headers = { Authorization: `Bearer ${jwt()}` };
  const unsupported = await handleAdminPancakeIntegrationRequest(new Request("https://api.test/api/admin/integrations/pancake?resource=../../secret", { headers }), database, { CMS_ADMIN_JWT_SECRET: "worker-secret" });
  assert.equal(unsupported.status, 400);
  const unsafe = await handleAdminPancakeIntegrationRequest(new Request("https://api.test/api/admin/integrations/pancake?resource=shops", { headers }), database, { CMS_ADMIN_JWT_SECRET: "worker-secret", PANCAKE_POS_API_KEY: "key", PANCAKE_POS_API_URL: "http://169.254.169.254/latest" });
  assert.equal(unsafe.status, 503);
});

test("Pancake proxy rejects oversized responses and reports upstream failure without leaking details", async () => {
  const request = new Request("https://api.test/api/admin/integrations/pancake?resource=shops", { headers: { Authorization: `Bearer ${jwt()}` } });
  const tooLarge = await handleAdminPancakeIntegrationRequest(request, database, { CMS_ADMIN_JWT_SECRET: "worker-secret", PANCAKE_POS_API_KEY: "key", fetch: async () => new Response("x".repeat(2 * 1024 * 1024 + 1)) });
  assert.equal(tooLarge.status, 502);
  assert.ok(!(await tooLarge.text()).includes("key"));
  const failed = await handleAdminPancakeIntegrationRequest(request, database, { CMS_ADMIN_JWT_SECRET: "worker-secret", PANCAKE_POS_API_KEY: "key", fetch: async () => new Response("upstream detail", { status: 500 }) });
  assert.equal(failed.status, 502);
  assert.ok(!(await failed.text()).includes("upstream detail"));
});
