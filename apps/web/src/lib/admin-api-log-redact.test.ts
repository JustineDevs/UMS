import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { redactAdminApiLogDetail } from "./admin-api-log-redact";

describe("redactAdminApiLogDetail", () => {
  it("redacts sensitive top-level keys", () => {
    const out = redactAdminApiLogDetail({
      route: "x",
      secretKey: "sk_live_abc",
      nested: { api_key: "hidden" },
    });
    assert.equal(out?.secretKey, "[REDACTED]");
    assert.deepEqual(out?.nested, { api_key: "[REDACTED]" });
    assert.equal(out?.route, "x");
  });

  it("truncates very long strings", () => {
    const long = "a".repeat(2500);
    const out = redactAdminApiLogDetail({ msg: long });
    assert.ok(String(out?.msg).length < long.length);
    assert.ok(String(out?.msg).includes("truncated"));
  });
});
