import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleAdminReceiptRequest } from "./receipt-admin.ts";

const secret = "receipt-test-secret";
function token(permission: string, organizationId = "org-a"): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    sub: "staff-1",
    role: "staff",
    permissions: [permission],
    organization_id: organizationId,
    exp: Math.floor(Date.now() / 1000) + 300,
  });
  return `${header}.${payload}.${createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")}`;
}

function client(queryFn: WorkerDatabaseClient["query"]): WorkerDatabaseClient {
  return { query: queryFn, async end() {} };
}

const env = { CMS_ADMIN_JWT_SECRET: secret };

test("admin receipt lookup resolves order display number and scopes the receipt to staff tenant", async () => {
  const appSql: string[] = [];
  const commerce = client(
    async <T extends Record<string, unknown>>(
      sql: string,
      values: readonly unknown[] = [],
    ) => {
      assert.match(sql, /display_id::text/);
      assert.match(
        sql,
        /COALESCE\(o\.metadata->>'organization_id', o\.metadata->>'store_id'\) = \$2/,
      );
      assert.deepEqual(values, ["104", "org-a"]);
      return {
        rows: [
          {
            id: "order_abc",
            display_id: 104,
            email: "buyer@example.com",
            total: 12000,
            currency_code: "php",
            created_at: "2026-01-01T00:00:00Z",
          },
        ] as T[],
        rowCount: 1,
      };
    },
  );
  const app = client(
    async <T extends Record<string, unknown>>(
      sql: string,
      values: readonly unknown[] = [],
    ) => {
      appSql.push(sql);
      assert.deepEqual(values, ["order_abc", "org-a"]);
      return {
        rows: [
          {
            id: "receipt-1",
            order_id: "order_abc",
            customer_email: "buyer@example.com",
            receipt_html: "<p>receipt</p>",
            sent_at: null,
            created_at: "2026-01-01T00:00:00Z",
          },
        ] as T[],
        rowCount: 1,
      };
    },
  );
  const response = await handleAdminReceiptRequest(
    new Request("https://worker.test/api/admin/receipts?order_id=104", {
      headers: { Authorization: `Bearer ${token("receipts:read")}` },
    }),
    app,
    commerce,
    env,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(
    ((await response.json()) as { data: { id: string } }).data.id,
    "receipt-1",
  );
  assert.match(appSql[0] ?? "", /organization_id = \$2/);
});

test("receipt creation reads canonical commerce data and persists tenant-scoped idempotent snapshot", async () => {
  const appSql: string[] = [];
  const app = client(
    async <T extends Record<string, unknown>>(
      sql: string,
      values: readonly unknown[] = [],
    ) => {
      appSql.push(sql);
      if (sql.includes("INSERT INTO public.worker_idempotency_records"))
        return {
          rows: [{ state: "pending", request_hash: values[1] }] as T[],
          rowCount: 1,
        };
      if (sql.includes("UPDATE public.worker_idempotency_records"))
        return { rows: [], rowCount: 1 };
      if (sql.includes("FROM public.digital_receipts"))
        return { rows: [] as T[], rowCount: 0 };
      if (sql.includes("INSERT INTO public.digital_receipts"))
        return {
          rows: [
            {
              id: "receipt-2",
              order_id: "order_abc",
              customer_email: "buyer@example.com",
              receipt_html: String(values[3]),
              sent_at: null,
              created_at: "2026-01-01T00:00:00Z",
            },
          ] as T[],
          rowCount: 1,
        };
      return { rows: [] as T[], rowCount: 1 };
    },
  );
  const commerce = client(
    async <T extends Record<string, unknown>>(
      sql: string,
      values: readonly unknown[] = [],
    ) => {
      if (sql.includes('FROM public."order"')) {
        assert.match(
          sql,
          /COALESCE\(o\.metadata->>'organization_id', o\.metadata->>'store_id'\) = \$2/,
        );
        assert.deepEqual(values, ["104", "org-a"]);
        return {
          rows: [
            {
              id: "order_abc",
              display_id: 104,
              email: "buyer@example.com",
              total: 12000,
              currency_code: "php",
              created_at: "2026-01-01T00:00:00Z",
            },
          ] as T[],
          rowCount: 1,
        };
      }
      if (sql.includes("public.order_line_item"))
        return {
          rows: [{ title: "<Guitar>", quantity: 1, unit_price: 12000 }] as T[],
          rowCount: 1,
        };
      throw new Error(`unexpected commerce query: ${sql}`);
    },
  );
  const response = await handleAdminReceiptRequest(
    new Request("https://worker.test/api/admin/receipts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token("receipts:send")}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "receipt-order-104-1",
      },
      body: JSON.stringify({ order_id: "104", send: false }),
    }),
    app,
    commerce,
    env,
  );
  assert.equal(response.status, 201);
  const payload = (await response.json()) as { data: { receipt_html: string } };
  assert.match(payload.data.receipt_html, /&lt;Guitar&gt;/);
  assert.ok(appSql.some((sql) => sql.includes("organization_id")));
  assert.ok(appSql.some((sql) => sql.includes("worker_idempotency_records")));
});

test("receipt mutations reject missing idempotency and cross-tenant lookup returns not found", async () => {
  let touched = false;
  const empty = client(async <T extends Record<string, unknown>>() => {
    touched = true;
    return { rows: [] as T[], rowCount: 0 };
  });
  const missingKey = await handleAdminReceiptRequest(
    new Request("https://worker.test/api/admin/receipts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token("receipts:send")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ order_id: "order_abc" }),
    }),
    empty,
    empty,
    env,
  );
  assert.equal(missingKey.status, 400);
  assert.equal(touched, false);

  const commerce = client(
    async <T extends Record<string, unknown>>(
      sql: string,
      values: readonly unknown[] = [],
    ) => {
      if (!sql.includes('FROM public."order"'))
        return { rows: [] as T[], rowCount: 0 };
      assert.match(
        sql,
        /COALESCE\(o\.metadata->>'organization_id', o\.metadata->>'store_id'\) = \$2/,
      );
      assert.deepEqual(values, ["104", "org-b"]);
      return { rows: [] as T[], rowCount: 0 };
    },
  );
  const app = client(async <T extends Record<string, unknown>>(sql: string) => {
    assert.match(sql, /organization_id = \$2/);
    return { rows: [] as T[], rowCount: 0 };
  });
  const lookup = await handleAdminReceiptRequest(
    new Request("https://worker.test/api/admin/receipts?order_id=104", {
      headers: { Authorization: `Bearer ${token("receipts:read", "org-b")}` },
    }),
    app,
    commerce,
    env,
  );
  assert.equal(lookup.status, 404);
});
