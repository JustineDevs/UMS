import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  evaluateWebCheckoutPolicy,
  evaluatePosSalePolicy,
  OMNICHANNEL_POLICY_VERSION,
} from "./engine.js";

describe("omnichannel-policy engine", () => {
  it("web allows when stock verified", () => {
    const r = evaluateWebCheckoutPolicy({ stockVerified: true });
    assert.equal(r.allowed, true);
    assert.equal(r.channel, "web");
    assert.equal(r.policyVersion, OMNICHANNEL_POLICY_VERSION);
    assert.equal(r.violations.length, 0);
    assert.match(r.decisionId, /^[a-f0-9]{32}$/);
  });

  it("web denies when stock not verified", () => {
    const r = evaluateWebCheckoutPolicy({ stockVerified: false });
    assert.equal(r.allowed, false);
    assert.ok(r.violations.some((v) => v.includes("stock")));
  });

  let prevPos: string | undefined;
  beforeEach(() => {
    prevPos = process.env.POS_SALE_REQUIRES_OPEN_SHIFT;
  });
  afterEach(() => {
    if (prevPos === undefined) delete process.env.POS_SALE_REQUIRES_OPEN_SHIFT;
    else process.env.POS_SALE_REQUIRES_OPEN_SHIFT = prevPos;
  });

  it("pos allows when shift not required", () => {
    delete process.env.POS_SALE_REQUIRES_OPEN_SHIFT;
    const r = evaluatePosSalePolicy({
      stockVerified: true,
      hasOpenShift: false,
      shiftIdProvided: false,
    });
    assert.equal(r.allowed, true);
  });

  it("pos denies when shift required and no open shift", () => {
    process.env.POS_SALE_REQUIRES_OPEN_SHIFT = "true";
    const r = evaluatePosSalePolicy({
      stockVerified: true,
      hasOpenShift: false,
      shiftIdProvided: true,
    });
    assert.equal(r.allowed, false);
  });
});
