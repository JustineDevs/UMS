import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleCourierTelemetryRequest } from "./courier-telemetry.ts";

test("courier telemetry rejects unsigned or incomplete ingress before querying", async () => {
  const database: WorkerDatabaseClient = { async query() { throw new Error("database must not be queried"); }, async end() {} };
  const response = await handleCourierTelemetryRequest(new Request("https://api.example/api/integrations/couriers/telemetry", { method: "POST", body: "{}" }), database, { COURIER_TELEMETRY_SECRET: "secret" });
  assert.equal(response.status, 400);
});
