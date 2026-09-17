import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { containsDangerousKey, parseAdminJson, verifyAdminStepUp, verifySignedRequest } from "./admin-api-security";

describe("admin API security primitives", () => {
  it("rejects prototype pollution keys recursively", () => {
    assert.equal(containsDangerousKey({ safe: [{ constructor: {} }] }), true);
    assert.equal(containsDangerousKey({ safe: true }), false);
  });

  it("rejects oversized and non-json payloads", async () => {
    const oversized = await parseAdminJson(new Request("http://admin.test", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: "x".repeat(20) }),
    }), undefined, 10);
    assert.equal(oversized.ok, false);
    const wrongType = await parseAdminJson(new Request("http://admin.test", {
      method: "POST", headers: { "content-type": "text/plain" }, body: "{}",
    }));
    assert.equal(wrongType.ok, false);
  });

  it("verifies timestamped webhook signatures and rejects stale requests", () => {
    const body = "{}";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", "secret").update(`${timestamp}.${body}`).digest("hex");
    assert.equal(verifySignedRequest(body, "secret", signature, timestamp), true);
    assert.equal(verifySignedRequest(body, "secret", signature, "1"), false);
  });

  it("verifies short-lived step-up assertions", () => {
    process.env.ADMIN_STEP_UP_SECRET = "step-up-test";
    const expires = Math.floor(Date.now() / 1000) + 60;
    const signature = createHmac("sha256", "step-up-test").update(`orders.refund.${expires}`).digest("hex");
    assert.equal(verifyAdminStepUp("orders.refund", `orders.refund.${expires}.${signature}`), true);
    delete process.env.ADMIN_STEP_UP_SECRET;
  });
});
