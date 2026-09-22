import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleAdminAnalyticsRequest } from "./analytics-admin.ts";

function token(claims: Record<string, unknown> = {}): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "staff_1", role: "staff", organization_id: "org_1", permissions: ["analytics:read"], exp: Math.floor(Date.now() / 1000) + 300, ...claims });
  return `${header}.${payload}.${createHmac("sha256", "analytics-secret").update(`${header}.${payload}`).digest("base64url")}`;
}

function database(onQuery: (sql: string, values: readonly unknown[]) => unknown) {
  const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
  const client: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      calls.push({ sql, values });
      return { rows: onQuery(sql, values) as T[], rowCount: 1 };
    },
    async end() {},
  };
  return { client, calls };
}

function request(path: string, auth?: string): Request {
  return new Request(`https://worker.test/api/admin/analytics/${path}`, {
    headers: auth ? { Authorization: `Bearer ${auth}` } : {},
  });
}

const env = { CMS_ADMIN_JWT_SECRET: "analytics-secret" };

test("analytics rejects unauthenticated and underprivileged access before querying commerce data", async () => {
  const db = database(() => []);
  assert.equal((await handleAdminAnalyticsRequest(request("retention"), db.client, env)).status, 401);
  assert.equal((await handleAdminAnalyticsRequest(request("retention", token({ permissions: ["orders:read"] })), db.client, env)).status, 403);
  assert.equal(db.calls.length, 0);
});

test("CLV is tenant-scoped, parameterized, and returns normalized aggregate values", async () => {
  const db = database((sql, values) => {
    assert.match(sql, /metadata->>'organization_id' = \$1/);
    assert.match(sql, /lower\(trim\(o\.email\)\) = \$2/);
    assert.match(sql, /oms_status/);
    assert.deepEqual(values, ["org_1", "buyer@example.test"]);
    return [{ customer_email: "buyer@example.test", total_spent: "250.50", order_count: "2", first_order_at: "2025-01-02T00:00:00.000Z", last_order_at: "2025-03-04T00:00:00.000Z" }];
  });
  const response = await handleAdminAnalyticsRequest(request("clv?email=Buyer%40Example.Test", token()), db.client, env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: {
    customer_email: "buyer@example.test", total_spent: 250.5, order_count: 2,
    avg_order_value: 125.25, first_order_at: "2025-01-02T00:00:00.000Z", last_order_at: "2025-03-04T00:00:00.000Z",
  } });
});

test("CLV validates email and returns not-found without leaking another tenant", async () => {
  const db = database(() => []);
  assert.equal((await handleAdminAnalyticsRequest(request("clv?email=bad", token()), db.client, env)).status, 400);
  assert.equal((await handleAdminAnalyticsRequest(request("clv?email=buyer%40example.test", token({ organization_id: "org_other" })), db.client, env)).status, 404);
  assert.deepEqual(db.calls[0]?.values, ["org_other", "buyer@example.test"]);
});

test("sales trends clamp the requested window and normalize numeric SQL aggregates", async () => {
  const db = database((sql, values) => {
    assert.match(sql, /metadata->>'organization_id' = \$1/);
    assert.match(sql, /generate_series\(\$2::int - 1, 0, -1\)/);
    assert.deepEqual(values, ["org_1", 24]);
    return [{ period: "2026-08", revenue: "99.90", order_count: "3" }];
  });
  const response = await handleAdminAnalyticsRequest(request("sales-trends?months=99", token()), db.client, env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: [{ period: "2026-08", revenue: 99.9, order_count: 3, avg_order_value: 33.3 }] });
});

test("retention query scopes prior and current customer activity to the same tenant", async () => {
  const db = database((sql, values) => {
    assert.match(sql, /prior\.created_utc < m\.month_start/);
    assert.match(sql, /metadata->>'organization_id' = \$1/);
    assert.deepEqual(values, ["org_1", 1]);
    return [{ period: "2026-09", new_customers: "1", returning_customers: "2", retention_rate: "0.6666667" }];
  });
  const response = await handleAdminAnalyticsRequest(request("retention?months=0", token()), db.client, env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: [{ period: "2026-09", new_customers: 1, returning_customers: 2, retention_rate: 0.6666667 }] });
});

test("analytics rejects malformed windows and unknown route names", async () => {
  const db = database(() => []);
  assert.equal((await handleAdminAnalyticsRequest(request("retention?months=6x", token()), db.client, env)).status, 400);
  assert.equal((await handleAdminAnalyticsRequest(request("unknown", token()), db.client, env)).status, 404);
  assert.equal(db.calls.length, 0);
});
