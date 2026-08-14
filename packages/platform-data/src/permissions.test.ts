import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  isStaffRbacStrictEnv,
  staffHasPermission,
  staffSessionAllows,
} from "./permissions.js";

describe("staffHasPermission", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_STAFF_RBAC_STRICT;
    delete process.env.STAFF_RBAC_STRICT;
  });
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_STAFF_RBAC_STRICT;
    delete process.env.STAFF_RBAC_STRICT;
  });

  it("denies when permissions are null, undefined, or empty", () => {
    assert.equal(staffHasPermission(undefined, "analytics:read"), false);
    assert.equal(staffHasPermission(null, "analytics:read"), false);
    assert.equal(staffHasPermission([], "dashboard:read"), false);
  });

  it("denies empty lists even when strict RBAC env is false", () => {
    assert.equal(isStaffRbacStrictEnv(), false);
    assert.equal(staffHasPermission([], "analytics:read"), false);
  });

  it("denies empty lists when strict RBAC env is true", () => {
    process.env.NEXT_PUBLIC_STAFF_RBAC_STRICT = "true";
    assert.equal(isStaffRbacStrictEnv(), true);
    assert.equal(staffHasPermission([], "analytics:read"), false);
  });

  it("allows when wildcard present", () => {
    assert.equal(staffHasPermission(["*", "pos:use"], "crm:read"), true);
  });

  it("requires explicit key when list is non-empty without wildcard", () => {
    assert.equal(staffHasPermission(["pos:use"], "pos:use"), true);
    assert.equal(staffHasPermission(["pos:use"], "crm:read"), false);
  });

  it("explicit integration admin grants are respected", () => {
    assert.equal(staffHasPermission(["integrations:manage"], "integrations:manage"), true);
  });
});

describe("staffSessionAllows", () => {
  it("uses admin wildcard when permissions array is empty", () => {
    assert.equal(
      staffSessionAllows(
        { user: { role: "admin", permissions: [] } },
        "catalog:write",
      ),
      true,
    );
  });

  it("denies staff with empty grants", () => {
    assert.equal(
      staffSessionAllows(
        { user: { role: "staff", permissions: [] } },
        "catalog:write",
      ),
      false,
    );
  });
});
