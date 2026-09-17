import assert from "node:assert/strict";
import test from "node:test";
import { matchesReceiptSignature } from "./payment-receipt-signature";

test("payment receipt signature validation rejects MIME spoofing", () => {
  assert.equal(matchesReceiptSignature("application/pdf", new TextEncoder().encode("%PDF-1.7")), true);
  assert.equal(matchesReceiptSignature("image/png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(matchesReceiptSignature("image/png", new TextEncoder().encode("not-a-png")), false);
  assert.equal(matchesReceiptSignature("application/pdf", new TextEncoder().encode("not-a-pdf")), false);
});
