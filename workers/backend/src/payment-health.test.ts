import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handlePaymentHealthRequest } from "./payment-health.ts";

function token(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "staff_1", exp: Math.floor(Date.now() / 1000) + 300, ...claims });
  const signature = createHmac("sha256", "admin-secret").update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

test("payment health denies unauthenticated and unauthorized staff", async () => {
  const database = { query: async () => { throw new Error("must not query"); }, end: async () => {} };
  const unauthenticated = await handlePaymentHealthRequest(new Request("https://api.test/api/admin/payment-health"), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(unauthenticated.status, 401);
  const unauthorized = await handlePaymentHealthRequest(new Request("https://api.test/api/admin/payment-health", { headers: { Authorization: `Bearer ${token({ role: "staff", organization_id: "org_1" })}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(unauthorized.status, 403);
});

test("payment health scopes connected providers to the authenticated organization", async () => {
  let values: readonly unknown[] = [];
  const database = {
    query: async <T extends Record<string, unknown>>(text: string, queryValues: readonly unknown[] = []) => {
      assert.match(text, /organization_id = \$1/);
      values = queryValues;
      return { rows: [{ provider: "stripe" }, { provider: "xendit" }] as T[], rowCount: 2 };
    },
    end: async () => {},
  };
  const response = await handlePaymentHealthRequest(new Request("https://api.test/api/admin/payment-health", { headers: { Authorization: `Bearer ${token({ role: "admin", organization_id: "org_1" })}` } }), database, {
    CMS_ADMIN_JWT_SECRET: "admin-secret",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    XENDIT_WEBHOOK_TOKEN: "xnd_token",
    PAYPAL_ENVIRONMENT: "sandbox",
  });
  assert.equal(response.status, 200);
  assert.deepEqual(values, ["org_1"]);
  const body = await response.json() as { providers: Record<string, { enabled: boolean }>; ok: boolean };
  assert.equal(body.providers.stripe.enabled, true);
  assert.equal(body.providers.xendit.enabled, true);
  assert.equal(body.providers.paypal.enabled, false);
  assert.equal(body.ok, true);
});
