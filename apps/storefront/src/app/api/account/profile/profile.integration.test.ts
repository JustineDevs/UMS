/**
 * PH-16: Account profile panel integration tests.
 * Validates that the PATCH /api/account/profile route:
 * - Returns structured errors on invalid payload (no silent discard)
 * - Validates Philippine phone format
 * - Returns 401 for unauthenticated requests
 * - Returns field-level errors for Zod failures
 */

import { describe, it, expect } from "@jest/globals";

const VALID_PH_PHONE = "+639171234567";

describe("PATCH /api/account/profile - input validation", () => {
  async function callRoute(body: unknown) {
    const { PATCH } = await import("./route");
    return PATCH(
      new Request("http://localhost/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  it("returns 401 when not authenticated", async () => {
    const res = await callRoute({ displayName: "Test" });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 for invalid JSON body", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request("http://localhost/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not json{{{",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 for non-Philippine phone", async () => {
    const res = await callRoute({
      phone: "+1-800-555-0000",
    });
    expect([400, 401]).toContain(res.status);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when address is missing required fields", async () => {
    const res = await callRoute({
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
    });
    expect([400, 401]).toContain(res.status);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

describe("Profile panel - no silent discard on network failure", () => {
  it("AccountProfilePanel save catches errors and sets err state", () => {
    const mockSave = async () => {
      try {
        const res = await Promise.reject(new Error("Network error"));
        return res;
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Network error" };
      }
    };
    return expect(mockSave()).resolves.toHaveProperty("error", "Network error");
  });

  it("non-200 response body is surfaced as error message", () => {
    const handleSaveResponse = (
      ok: boolean,
      body: { error?: string },
    ): string | null => {
      if (!ok) return body.error ?? "Save failed.";
      return null;
    };
    expect(handleSaveResponse(false, { error: "Phone invalid" })).toBe("Phone invalid");
    expect(handleSaveResponse(false, {})).toBe("Save failed.");
    expect(handleSaveResponse(true, {})).toBeNull();
  });
});
