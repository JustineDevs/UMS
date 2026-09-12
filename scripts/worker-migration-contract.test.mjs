import test from "node:test";
import assert from "node:assert/strict";
import {
  migrationChecksum,
  validateMigrationRecord,
  validateRequiredSchema,
} from "./worker-migration-contract.mjs";

test("worker migration checksum is stable and detects drift", () => {
  const checksum = migrationChecksum("create table worker_state (id uuid)");
  assert.equal(checksum, migrationChecksum("create table worker_state (id uuid)"));
  assert.deepEqual(validateMigrationRecord({ checksum }, checksum), {
    applied: true,
    valid: true,
    reason: "verified",
  });
  assert.equal(validateMigrationRecord({ checksum: "stale" }, checksum).reason, "checksum_mismatch");
});

test("worker schema contract reports missing tables and columns", () => {
  const result = validateRequiredSchema(
    ["worker_schema_migrations", "worker_idempotency_records", "payment_attempts"],
    [
      { table: "worker_idempotency_records", column: "idempotency_key" },
      { table: "payment_attempts", column: "correlation_id" },
    ],
  );
  assert.equal(result.valid, false);
  assert.deepEqual(result.missingTables, ["payment_webhook_events"]);
  assert.ok(result.missingColumns.includes("worker_idempotency_records.request_hash"));
  assert.ok(result.missingColumns.includes("payment_attempts.cart_id"));
});
