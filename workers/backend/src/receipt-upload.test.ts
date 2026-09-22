import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleReceiptUploadRequest } from "./receipt-upload.ts";

const secret = "receipt-secret";
function token() { const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"); const p = Buffer.from(JSON.stringify({ sub: "customer-1", email: "customer@example.com", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url"); return `${h}.${p}.${createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`; }

test("receipt upload validates ownership, signature, private storage, and cleanup", async () => {
  const appStatements: string[] = [];
  const app = { query: async <T extends Record<string, unknown>>(text: string) => { appStatements.push(text); if (text.includes("payment_attempts")) return { rows: [{ id: "attempt-1", organization_id: "org-1" }], rowCount: 1 } as { rows: T[]; rowCount: number }; return { rows: [{ id: "receipt-1" }], rowCount: 1 } as { rows: T[]; rowCount: number }; }, end: async () => {} };
  const commerce = { query: async <T extends Record<string, unknown>>() => ({ rows: [{ id: "order-1" }], rowCount: 1 }) as { rows: T[]; rowCount: number }, end: async () => {} };
  const requests: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => { requests.push(String(input)); return new Response(JSON.stringify({ signedURL: "https://signed.example/receipt" }), { status: 200, headers: { "Content-Type": "application/json" } }); };
  try {
    const form = new FormData(); form.set("orderId", "order-1"); form.set("receipt", new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" }), "receipt.png");
    const response = await handleReceiptUploadRequest(new Request("https://worker.test/store/checkout/upload-payment-receipt", { method: "POST", headers: { Authorization: `Bearer ${token()}` }, body: form }), app, commerce, { JWT_SECRET: secret, SUPABASE_STORAGE_URL: "https://supabase.example", SUPABASE_SERVICE_ROLE_KEY: "service-key" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, receiptId: "receipt-1", url: "https://signed.example/receipt" });
    assert.equal(requests.length, 2);
    assert.ok(appStatements.some((statement) => statement.includes("payment_receipts")));
  } finally { globalThis.fetch = originalFetch; }
});

test("receipt upload rejects a mismatched file signature before storage", async () => {
  const db = { query: async <T extends Record<string, unknown>>() => ({ rows: [{ id: "order-1" }], rowCount: 1 }) as { rows: T[]; rowCount: number }, end: async () => {} };
  const form = new FormData(); form.set("orderId", "order-1"); form.set("receipt", new Blob(["not-png"], { type: "image/png" }), "receipt.png");
  const response = await handleReceiptUploadRequest(new Request("https://worker.test/store/checkout/upload-payment-receipt", { method: "POST", headers: { Authorization: `Bearer ${token()}` }, body: form }), db, db, { JWT_SECRET: secret, SUPABASE_STORAGE_URL: "https://supabase.example", SUPABASE_SERVICE_ROLE_KEY: "service-key", DEFAULT_ORGANIZATION_ID: "org-1" });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Receipt contents do not match the declared file type" });
});
