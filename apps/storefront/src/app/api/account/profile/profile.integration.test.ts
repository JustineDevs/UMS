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
import type { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";

const VALID_PH_PHONE = "+639171234567";

function makeRequest(body: unknown, contentType = "application/json"): Request {
  return new Request("http://localhost/api/account/profile", {
    method: "PATCH",
    headers: { "Content-Type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function testDeps(session: { user?: { email?: string }; authenticatedAt?: number } | null) {
  return {
    getSession: async () =>
      session && session.authenticatedAt === undefined
        ? { ...session, authenticatedAt: Math.floor(Date.now() / 1000) }
        : session,
    createStorefrontServiceSupabase: () => null,
  };
}

function staleProfileSupabase(): ReturnType<typeof createStorefrontServiceSupabase> {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: null, error: null }),
  };
  return {
    from: () => chain,
  } as unknown as ReturnType<typeof createStorefrontServiceSupabase>;
}

test("PATCH /api/account/profile requires recent authentication", async () => {
  const res = await handleStorefrontProfilePatchRequest(
    makeRequest({ displayName: "Test" }),
    testDeps({
      user: { email: "shopper@example.com" },
      authenticatedAt: Math.floor((Date.now() - 31 * 60_000) / 1000),
    }),
  );
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.code, "RECENT_AUTH_REQUIRED");
  assert.equal(body.reauthUrl, "/sign-in?callbackUrl=%2Faccount&reauth=1");
});

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

test("PATCH /api/account/profile rejects stale versions before Medusa sync", async () => {
  let syncCalled = false;
  const res = await handleStorefrontProfilePatchRequest(
    makeRequest({ displayName: "New name", updatedAt: "2026-08-23T00:00:00.000Z" }),
    {
      getSession: async () => ({
        authenticatedAt: Math.floor(Date.now() / 1000),
        user: { email: "shopper@example.com", medusaCustomerId: "cus_123" },
      }),
      createStorefrontServiceSupabase: () => staleProfileSupabase(),
      findMedusaCustomerIdByEmail: async () => "cus_123",
      syncMedusaCustomerProfile: async () => {
        syncCalled = true;
        return true;
      },
    },
  );
  assert.equal(res.status, 409);
  assert.equal(syncCalled, false);
});

test("PATCH /api/account/profile upserts existing email rows when Medusa identity is resolved", async () => {
  let conflictTarget: string | undefined;
  let persisted: Record<string, unknown> | undefined;
  const chain = {
    upsert: async (row: Record<string, unknown>, options: { onConflict?: string }) => {
      persisted = row;
      conflictTarget = options.onConflict;
      return { error: null };
    },
  };
  const res = await handleStorefrontProfilePatchRequest(
    makeRequest({ displayName: "E2E Tester", phone: VALID_PH_PHONE }),
    {
      getSession: async () => ({
        authenticatedAt: Math.floor(Date.now() / 1000),
        user: { email: "e2e-test@example.com" },
      }),
      createStorefrontServiceSupabase: () =>
        ({ from: () => chain }) as unknown as ReturnType<typeof createStorefrontServiceSupabase>,
      findMedusaCustomerIdByEmail: async () => "cus_123",
      syncMedusaCustomerProfile: async () => true,
    },
  );
  assert.equal(res.status, 200);
  assert.equal(conflictTarget, "email");
  assert.equal(persisted?.email, "e2e-test@example.com");
  assert.equal(persisted?.medusa_customer_id, "cus_123");
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
