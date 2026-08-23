import assert from "node:assert/strict";
import test from "node:test";
import { assertInvoiceTransition, recordInvoiceLifecycle } from "./invoice-lifecycle.js";

test("invoice lifecycle permits retry, void, and refund paths", () => {
  assert.doesNotThrow(() => assertInvoiceTransition("failed", "retry", "retryable"));
  assert.doesNotThrow(() => assertInvoiceTransition("sent", "refund", "refunded"));
  assert.throws(() => assertInvoiceTransition("refunded", "send", "sent"), /Invalid invoice transition/);
});

test("invoice lifecycle sends tenant and idempotency keys to the durable RPC", async () => {
  let call: { name: string; args: Record<string, unknown> } | undefined;
  const result = await recordInvoiceLifecycle(
    {
      rpc: async (name: string, args: Record<string, unknown>) => {
        call = { name, args };
        return { data: { status: "sent" }, error: null };
      },
    } as never,
    {
      organizationId: " org_1 ",
      invoiceId: " invoice_1 ",
      event: "send",
      status: "sent",
      fiscalStatus: "non_fiscal",
      idempotencyKey: " key_1 ",
    },
  );
  assert.equal(result.status, "sent");
  assert.equal(call?.name, "record_invoice_lifecycle");
  assert.equal(call?.args.p_organization_id, "org_1");
  assert.equal(call?.args.p_idempotency_key, "key_1");
});
