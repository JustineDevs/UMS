import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { correlatedError, correlatedJson } from "./staff-api-response";

describe("correlatedJson", () => {
  it("sets x-request-id header", async () => {
    const res = correlatedJson("req-abc", { ok: true });
    assert.equal(res.headers.get("x-request-id"), "req-abc");
    const body = await res.json();
    assert.deepEqual(body, { ok: true });
  });

  it("emits a problem response while preserving legacy error fields", async () => {
    const res = correlatedError("req-error", 503, "database unavailable", "SERVICE_UNAVAILABLE");
    assert.equal(res.status, 503);
    assert.equal(res.headers.get("content-type"), "application/problem+json");
    assert.deepEqual(await res.json(), {
      type: "https://api.universalmusic.store/problems/service_unavailable",
      title: "SERVICE UNAVAILABLE",
      status: 503,
      detail: "The request could not be completed.",
      error: "The request could not be completed.",
      code: "SERVICE_UNAVAILABLE",
      requestId: "req-error",
      retryable: true,
    });
  });
});
