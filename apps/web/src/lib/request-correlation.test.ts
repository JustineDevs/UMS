import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCorrelationId } from "./request-correlation";

describe("getCorrelationId", () => {
  it("uses x-request-id when present", () => {
    const req = new Request("http://localhost/api", {
      headers: { "x-request-id": "abc-123" },
    });
    assert.equal(getCorrelationId(req), "abc-123");
  });

  it("uses x-correlation-id when x-request-id is absent", () => {
    const req = new Request("http://localhost/api", {
      headers: { "x-correlation-id": "corr-9" },
    });
    assert.equal(getCorrelationId(req), "corr-9");
  });

  it("generates a UUID when no header is set", () => {
    const req = new Request("http://localhost/api");
    const id = getCorrelationId(req);
    assert.match(id, /^[0-9a-f-]{36}$/i);
  });
});
