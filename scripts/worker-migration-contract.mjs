import { createHash } from "node:crypto";

export const WORKER_MIGRATIONS = Object.freeze([
  {
    filename: "001_worker_payment_ledger.sql",
    requiredTables: Object.freeze([
      "worker_schema_migrations",
      "worker_idempotency_records",
      "payment_attempts",
      "payment_webhook_events",
    ]),
    requiredColumns: Object.freeze({
      worker_idempotency_records: ["idempotency_key", "request_hash", "response_body", "expires_at"],
      payment_attempts: ["correlation_id", "cart_id", "provider", "status", "checkout_state"],
      payment_webhook_events: ["provider", "event_id", "payload", "status", "correlation_id"],
    }),
  },
]);

export function migrationChecksum(sql) {
  return createHash("sha256").update(sql).digest("hex");
}

export function validateMigrationRecord(record, expectedChecksum) {
  if (!record) return { applied: false, valid: false, reason: "not_applied" };
  if (!record.checksum) return { applied: true, valid: false, reason: "missing_checksum" };
  if (record.checksum !== expectedChecksum) {
    return { applied: true, valid: false, reason: "checksum_mismatch" };
  }
  return { applied: true, valid: true, reason: "verified" };
}

export function validateRequiredSchema(tableNames, columnNames) {
  const tables = new Set(tableNames);
  const contract = WORKER_MIGRATIONS[0];
  const missingTables = contract.requiredTables.filter((table) => !tables.has(table));
  const missingColumns = Object.entries(contract.requiredColumns).flatMap(([table, columns]) =>
    columns.filter((column) => !columnNames.some((entry) => entry.table === table && entry.column === column))
      .map((column) => `${table}.${column}`),
  );
  return {
    valid: missingTables.length === 0 && missingColumns.length === 0,
    missingTables,
    missingColumns,
  };
}
