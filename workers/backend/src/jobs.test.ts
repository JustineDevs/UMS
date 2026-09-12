import test from "node:test";
import assert from "node:assert/strict";
import { deliverNotification, expireDueReservations } from "./jobs.ts";
import { createCommerceJob } from "./queue.ts";

test("expires due reservations through the tenant-scoped APP RPC", async () => {
  const queries: Array<{ sql: string; values: readonly unknown[] }> = [];
  const database = {
    async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      queries.push({ sql, values });
      return { rows: [{ count: 3 } as T], rowCount: 1 };
    },
    async end() {},
  };
  const count = await expireDueReservations(
    database,
    createCommerceJob("inventory-reservation-expiry", { tenantId: "org-a", limit: 25 }),
  );
  assert.equal(count, 3);
  assert.match(queries[0]?.sql ?? "", /inventory_reservation_expire_due/);
  assert.deepEqual(queries[0]?.values, ["org-a", 25]);
});

test("rejects malformed reservation expiry payloads before database access", async () => {
  let queried = false;
  const database = {
    async query() {
      queried = true;
      return { rows: [], rowCount: 0 };
    },
    async end() {},
  };
  await assert.rejects(
    () => expireDueReservations(database, createCommerceJob("inventory-reservation-expiry", { tenantId: "", limit: 1 })),
    /invalid_reservation_expiry_tenant/,
  );
  assert.equal(queried, false);
});

test("claims a notification attempt and records the Resend message id", async () => {
  const queries: Array<{ sql: string; values: readonly unknown[] }> = [];
  const database = {
    async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      queries.push({ sql, values });
      if (sql.startsWith("UPDATE public.public_delivery_attempts\n     SET status = 'retry'")) {
        return { rows: [{ id: "00000000-0000-4000-8000-000000000004" } as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
    async end() {},
  };
  const response = await deliverNotification(
    database,
    { RESEND_API_KEY: "re_test", RESEND_FROM_EMAIL: "store@example.com" },
    createCommerceJob("notification-delivery", {
      attemptId: "00000000-0000-4000-8000-000000000004",
      recipient: "Customer@example.com",
      subject: "Your order",
      html: "<p>Ready</p>",
    }),
    async (_url, init) => {
      assert.equal(init?.headers && new Headers(init.headers).get("Idempotency-Key"), "00000000-0000-4000-8000-000000000004");
      return new Response(JSON.stringify({ id: "re_123" }), { status: 200 });
    },
  );
  assert.equal(response, "re_123");
  assert.equal(queries.length, 2);
  assert.match(queries[1]?.sql ?? "", /provider_message_id/);
});

test("records a retry when Resend rejects the notification", async () => {
  const updates: string[] = [];
  const database = {
    async query<T extends Record<string, unknown>>(sql: string) {
      updates.push(sql);
      if (sql.includes("RETURNING id")) return { rows: [{ id: "x" } as T], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
    async end() {},
  };
  await assert.rejects(
    () => deliverNotification(
      database,
      { RESEND_API_KEY: "re_test" },
      createCommerceJob("notification-delivery", {
        attemptId: "00000000-0000-4000-8000-000000000005",
        recipient: "customer@example.com",
        subject: "Your order",
        html: "<p>Ready</p>",
      }),
      async () => new Response(JSON.stringify({ message: "temporary" }), { status: 503 }),
    ),
    /notification_provider_rejected/,
  );
  assert.ok(updates.some((sql) => sql.includes("status = 'retry'")));
});
