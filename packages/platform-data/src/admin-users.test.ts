import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkStaffRole, isStaffRole } from "./admin-users.js";

describe("isStaffRole", () => {
  it("returns true for admin and staff", () => {
    assert.strictEqual(isStaffRole("admin"), true);
    assert.strictEqual(isStaffRole("staff"), true);
  });
  it("returns false for customer and member", () => {
    assert.strictEqual(isStaffRole("customer"), false);
    assert.strictEqual(isStaffRole("member"), false);
  });
});

describe("checkStaffRole", () => {
  it("returns NO_SESSION when session is null", () => {
    const result = checkStaffRole(null);
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.status, 401);
      assert.strictEqual(result.code, "NO_SESSION");
    }
  });

  it("returns NO_SESSION when session has no user", () => {
    const result = checkStaffRole({});
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.status, 401);
      assert.strictEqual(result.code, "NO_SESSION");
    }
  });

  it("returns NOT_STAFF when role is customer", () => {
    const result = checkStaffRole({ user: { role: "customer" } });
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.status, 403);
      assert.strictEqual(result.code, "NOT_STAFF");
    }
  });

  it("returns NOT_STAFF when role is member", () => {
    const result = checkStaffRole({ user: { role: "member" } });
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.status, 403);
      assert.strictEqual(result.code, "NOT_STAFF");
    }
  });

  it("returns NOT_STAFF when role is undefined", () => {
    const result = checkStaffRole({ user: {} });
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.status, 403);
      assert.strictEqual(result.code, "NOT_STAFF");
    }
  });

  it("returns ok when role is admin", () => {
    const result = checkStaffRole({ user: { role: "admin" } });
    assert.strictEqual(result.ok, true);
  });

  it("returns ok when role is staff", () => {
    const result = checkStaffRole({ user: { role: "staff" } });
    assert.strictEqual(result.ok, true);
  });
});
