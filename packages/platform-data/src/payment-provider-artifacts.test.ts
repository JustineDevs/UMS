import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildPaymentTerminalArtifactBindingRows,
  upsertPaymentTerminalArtifactBinding,
} from "./payment-provider-artifacts.js";

test("payment terminal artifact mapping binds provider terminal to POS device", () => {
  const rows = buildPaymentTerminalArtifactBindingRows({
    organization_id: "org_1",
    merchant_identity: "acct_1",
    provider: "stripe",
    external_id: "tmr_123",
    device_id: "00000000-0000-0000-0000-000000000001",
    model: "WisePOS E",
    serial_number: "SN123",
  });

  assert.equal(rows.artifact.artifact_type, "terminal");
  assert.equal(rows.artifact.metadata.pos_device_id, rows.terminal.device_id);
  assert.equal(rows.terminal.provider_terminal_external_id, "tmr_123");
});

test("upsertPaymentTerminalArtifactBinding persists artifact id onto terminal row", async () => {
  const calls: Array<{ table: string; row: Record<string, unknown> }> = [];
  const supabase = {
    from(table: string) {
      return {
        upsert(row: Record<string, unknown>) {
          calls.push({ table, row });
          if (table === "payment_provider_artifacts") {
            return {
              select() {
                return {
                  single: async () => ({ data: { id: "artifact_1" }, error: null }),
                };
              },
            };
          }
          return Promise.resolve({ error: null });
        },
      };
    },
  } as unknown as SupabaseClient;

  const ok = await upsertPaymentTerminalArtifactBinding(supabase, {
    organization_id: "org_1",
    merchant_identity: "acct_1",
    provider: "stripe",
    external_id: "tmr_123",
    device_id: "00000000-0000-0000-0000-000000000001",
    model: "WisePOS E",
    serial_number: "SN123",
  });

  assert.equal(ok, true);
  assert.equal(calls[0]?.table, "payment_provider_artifacts");
  assert.equal(calls[1]?.table, "pos_payment_terminals");
  assert.equal(calls[1]?.row.payment_provider_artifact_id, "artifact_1");
});
