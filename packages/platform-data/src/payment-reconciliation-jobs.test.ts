import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requestProviderReconciliationJob } from "./payment-reconciliation-jobs.js";

type Capture = {
  existingJobId?: string;
  insertedJobId?: string;
  artifact?: Record<string, unknown>;
  filters: Array<{ method: string; args: unknown[] }>;
};

function createSupabaseStub(capture: Capture): SupabaseClient {
  const selectChain = {
    eq(...args: unknown[]) {
      capture.filters.push({ method: "eq", args });
      return selectChain;
    },
    limit() {
      return Promise.resolve({
        data: capture.existingJobId ? [{ id: capture.existingJobId }] : [],
        error: null,
      });
    },
  };
  return {
    from(table: string) {
      return {
        select() {
          return selectChain;
        },
        insert(payload: Record<string, unknown>) {
          capture.filters.push({ method: "insert", args: [table, payload] });
          return {
            select() {
              return {
                single: async () => ({
                  data: { id: capture.insertedJobId },
                  error: null,
                }),
              };
            },
          };
        },
        upsert(payload: Record<string, unknown>) {
          capture.artifact = payload;
          return Promise.resolve({ error: null });
        },
      };
    },
  } as unknown as SupabaseClient;
}

describe("provider reconciliation jobs", () => {
  it("reuses tenant/provider/idempotency jobs and records reconciliation artifact", async () => {
    const capture: Capture = { existingJobId: "job_1", filters: [] };
    const result = await requestProviderReconciliationJob(createSupabaseStub(capture), {
      organizationId: "org_1",
      merchantIdentity: "merchant_1",
      provider: "stripe",
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-08-02T00:00:00.000Z",
      idempotencyKey: "idem_123456",
      createdBy: "ops@example.com",
    });

    assert.deepEqual(result, {
      jobId: "job_1",
      artifactExternalId: "reconciliation:stripe:idem_123456",
      reused: true,
    });
    assert.equal(capture.artifact?.organization_id, "org_1");
    assert.equal(capture.artifact?.provider, "stripe");
    assert.equal(capture.artifact?.artifact_type, "reconciliation");
    assert.equal(capture.artifact?.idempotency_key, "idem_123456");
    assert.equal(
      (capture.artifact?.metadata as Record<string, unknown>).job_id,
      "job_1",
    );
    assert.equal(
      capture.filters.some(
        (filter) =>
          filter.method === "eq" &&
          filter.args[0] === "payload->>organizationId" &&
          filter.args[1] === "org_1",
      ),
      true,
    );
  });
});
