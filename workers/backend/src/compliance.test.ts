import test from "node:test";
import assert from "node:assert/strict";
import { handleComplianceRequest } from "./compliance.ts";
import type { WorkerDatabaseClient } from "./database.ts";

type Call = { role: "app" | "medusa"; text: string; values: readonly unknown[] };

function fakeDatabases(calls: Call[]) {
  const make = (role: "app" | "medusa"): WorkerDatabaseClient => ({
    async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      calls.push({ role, text, values });
      if (role === "app" && text.includes("FROM public.users")) {
        return { rows: [{ value: { id: "user_1", email: "buyer@example.com" } }] as T[], rowCount: 1 };
      }
      if (role === "app" && text.includes("storefront_customer_profiles")) {
        if (text.includes("SELECT medusa_customer_id")) {
          return { rows: [{ medusa_customer_id: "cus_1" }] as T[], rowCount: 1 };
        }
        return { rows: [{ value: { email: "buyer@example.com", medusa_customer_id: "cus_1" } }] as T[], rowCount: 1 };
      }
      if (role === "medusa" && text.includes("FROM public.customer")) {
        if (text.includes("SELECT id FROM")) {
          return { rows: [{ id: "cus_1" }] as T[], rowCount: 1 };
        }
        return { rows: [{ value: { id: "cus_1", email: "buyer@example.com" } }] as T[], rowCount: 1 };
      }
      if (role === "medusa" && text.includes('FROM public."order"')) {
        return { rows: [{ value: { id: "order_1", email: "buyer@example.com" } }] as T[], rowCount: 1 };
      }
      if (text.startsWith("SELECT") && text.includes("row_to_json")) {
        return { rows: [] as T[], rowCount: 0 };
      }
      return { rows: [] as T[], rowCount: 1 };
    },
    async end() {},
  });
  return (role: "app" | "medusa") => make(role);
}

test("compliance rejects requests without the internal API key", async () => {
  const response = await handleComplianceRequest(
    new Request("https://api.example.com/compliance/export?email=buyer%40example.com"),
    { INTERNAL_API_KEY: "secret", databaseFactory: () => { throw new Error("database must not be opened"); } },
  );
  assert.equal(response.status, 401);
});

test("compliance rejects a bearer token when the internal contract is required", async () => {
  const response = await handleComplianceRequest(
    new Request("https://api.example.com/compliance/export?email=buyer%40example.com", {
      headers: { Authorization: "Bearer secret" },
    }),
    { INTERNAL_API_KEY: "secret", databaseFactory: () => { throw new Error("database must not be opened"); } },
  );
  assert.equal(response.status, 401);
});

test("compliance export aggregates APP and Medusa records with parameterized email", async () => {
  const calls: Call[] = [];
  const response = await handleComplianceRequest(
    new Request("https://api.example.com/compliance/export?email=Buyer%40Example.com" , {
      headers: { "X-Internal-API-Key": "secret" },
    }),
    { INTERNAL_API_KEY: "secret", databaseFactory: fakeDatabases(calls) },
  );
  assert.equal(response.status, 200);
  const body = await response.json() as { email: string; app: Record<string, unknown[]>; medusa: { orders: unknown[] } };
  assert.equal(body.email, "buyer@example.com");
  assert.equal(body.app.users.length, 1);
  assert.equal(body.medusa.orders.length, 1);
  assert.ok(calls.every((call) => !call.text.includes("buyer@example.com")));
  assert.ok(calls.some((call) => call.role === "app" && call.values.includes("buyer@example.com")));
  assert.ok(calls.some((call) => call.role === "medusa" && call.values.includes("buyer@example.com")));
});

test("erasure uses separate transactions and reports Medusa anonymization", async () => {
  const calls: Call[] = [];
  const response = await handleComplianceRequest(
    new Request("https://api.example.com/compliance/erasure", {
      method: "POST",
      headers: { "X-Internal-API-Key": "secret", "Content-Type": "application/json" },
      body: JSON.stringify({ email: "buyer@example.com" }),
    }),
    { INTERNAL_API_KEY: "secret", databaseFactory: fakeDatabases(calls) },
  );
  assert.equal(response.status, 200);
  const body = await response.json() as { ok: boolean; medusa: { customerAnonymized: boolean } };
  assert.equal(body.ok, true);
  assert.equal(body.medusa.customerAnonymized, true);
  assert.ok(calls.some((call) => call.text === "BEGIN" && call.role === "app"));
  assert.ok(calls.some((call) => call.text === "BEGIN" && call.role === "medusa"));
  assert.ok(calls.some((call) => call.text.includes("UPDATE public.customer SET email")));
});

test("retention rejects unsafe windows before opening the database", async () => {
  const response = await handleComplianceRequest(
    new Request("https://api.example.com/compliance/retention/anonymize-addresses", {
      method: "POST",
      headers: { "X-Internal-API-Key": "secret", "Content-Type": "application/json" },
      body: JSON.stringify({ days: 0 }),
    }),
    { INTERNAL_API_KEY: "secret", databaseFactory: () => { throw new Error("database must not be opened"); } },
  );
  assert.equal(response.status, 400);
});
