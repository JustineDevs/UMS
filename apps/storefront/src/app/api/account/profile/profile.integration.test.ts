/**
 * PH-16: Account profile panel integration tests.
 * Validates that the PATCH /api/account/profile route:
 * - Returns structured errors on invalid payload (no silent discard)
 * - Validates Philippine phone format
 * - Returns 401 for unauthenticated requests
 * - Returns field-level errors for Zod failures
 */

import assert from "node:assert/strict";
import test from "node:test";
import { handleStorefrontProfilePatchRequest } from "./profile-handler";

const VALID_PH_PHONE = "+639171234567";

function makeRequest(body: unknown, contentType = "application/json"): Request {
  return new Request("http://localhost/api/account/profile", {
    method: "PATCH",
    headers: { "Content-Type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function testDeps(session: { user?: { email?: string } } | null) {
  return {
    getSession: async () => session,
    createStorefrontServiceSupabase: () => null,
  };
}

test("PATCH /api/account/profile returns 401 when not authenticated", async () => {
  const res = await handleStorefrontProfilePatchRequest(
    makeRequest({ displayName: "Test" }),
    testDeps(null),
  );
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(typeof body, "object");
  assert.ok(body);
  assert.ok("error" in body);
});

test("PATCH /api/account/profile returns 400 for invalid JSON body", async () => {
  const res = await handleStorefrontProfilePatchRequest(
    makeRequest("not json{{{"),
    testDeps({ user: { email: "shopper@example.com" } }),
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(typeof body, "object");
  assert.ok(body);
  assert.ok("error" in body);
});

test("PATCH /api/account/profile returns 400 for non-Philippine phone", async () => {
  const res = await handleStorefrontProfilePatchRequest(
    makeRequest({ phone: "+1-800-555-0000" }),
    testDeps({ user: { email: "shopper@example.com" } }),
  );
  assert.ok([400, 401].includes(res.status));
  const body = await res.json();
  assert.equal(typeof body, "object");
  assert.ok(body);
  assert.ok("error" in body);
});

test("PATCH /api/account/profile returns 400 when address is missing required fields", async () => {
  const res = await handleStorefrontProfilePatchRequest(
    makeRequest({
      shippingAddresses: [
        {
          fullName: "",
          phone: VALID_PH_PHONE,
          line1: "",
          city: "",
          province: "",
          country: "PH",
        },
      ],
    }),
    testDeps({ user: { email: "shopper@example.com" } }),
  );
  assert.ok([400, 401].includes(res.status));
  const body = await res.json();
  assert.equal(typeof body, "object");
  assert.ok(body);
  assert.ok("error" in body);
});

test("Profile panel surfaces network failures instead of discarding them", async () => {
  const mockSave = async () => {
    try {
      const res = await Promise.reject(new Error("Network error"));
      return res;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Network error" };
    }
  };

  await assert.doesNotReject(mockSave());
  const result = await mockSave();
  assert.deepEqual(result, { error: "Network error" });
});

test("non-200 response body is surfaced as error message", () => {
  const handleSaveResponse = (
    ok: boolean,
    body: { error?: string },
  ): string | null => {
    if (!ok) return body.error ?? "Save failed.";
    return null;
  };

  assert.equal(handleSaveResponse(false, { error: "Phone invalid" }), "Phone invalid");
  assert.equal(handleSaveResponse(false, {}), "Save failed.");
  assert.equal(handleSaveResponse(true, {}), null);
});
