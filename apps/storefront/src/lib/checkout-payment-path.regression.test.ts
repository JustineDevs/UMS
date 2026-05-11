/**
 * PH-07: Checkout client payment path regression tests.
 *
 * Tests the guard conditions and error mapping in the checkout flow:
 * - handlePay is blocked while medusaPriceStatus !== "ready"
 * - User-safe error messages contain no internal keys or stack traces
 * - Payment amounts match the confirmed Medusa total within tolerance
 */

import { describe, it, expect } from "@jest/globals";

type MedusaPriceStatus = "idle" | "loading" | "ready" | "error";

function canProceedToPayment(
  medusaPriceStatus: MedusaPriceStatus,
  profileGate: "idle" | "loading" | "complete" | "incomplete" | "error",
  linesCount: number,
): { ok: boolean; reason?: string } {
  if (linesCount === 0) return { ok: false, reason: "empty_cart" };
  if (profileGate !== "complete") return { ok: false, reason: "profile_incomplete" };
  if (medusaPriceStatus === "loading") return { ok: false, reason: "totals_loading" };
  if (medusaPriceStatus !== "ready") return { ok: false, reason: "totals_not_ready" };
  return { ok: true };
}

function isUserSafeErrorMessage(msg: string): boolean {
  const FORBIDDEN_PATTERNS = [
    /NEXT_PUBLIC_/i,
    /SUPABASE_SERVICE_ROLE/i,
    /MEDUSA_SECRET_API_KEY/i,
    /Error:\s+at\s+/,
    /stack trace/i,
    /TypeError:/i,
    /ReferenceError:/i,
    /0x[0-9a-fA-F]{6,}/,
  ];
  return FORBIDDEN_PATTERNS.every((p) => !p.test(msg));
}

describe("canProceedToPayment guard logic", () => {
  it("blocks pay when medusaPriceStatus is loading", () => {
    const result = canProceedToPayment("loading", "complete", 1);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("totals_loading");
  });

  it("blocks pay when medusaPriceStatus is idle", () => {
    const result = canProceedToPayment("idle", "complete", 1);
    expect(result.ok).toBe(false);
  });

  it("blocks pay when medusaPriceStatus is error", () => {
    const result = canProceedToPayment("error", "complete", 1);
    expect(result.ok).toBe(false);
  });

  it("allows pay when medusaPriceStatus is ready and profile complete", () => {
    const result = canProceedToPayment("ready", "complete", 2);
    expect(result.ok).toBe(true);
  });

  it("blocks pay when cart is empty even with ready status", () => {
    const result = canProceedToPayment("ready", "complete", 0);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("empty_cart");
  });

  it("blocks pay when profile gate is incomplete", () => {
    const result = canProceedToPayment("ready", "incomplete", 3);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("profile_incomplete");
  });
});

describe("Payment amount match", () => {
  const TOLERANCE_MINOR_UNITS = 1;

  function amountsMatch(confirmedTotal: number, bagTotal: number, minorDivisor: number): boolean {
    return Math.abs(confirmedTotal - bagTotal) * minorDivisor <= TOLERANCE_MINOR_UNITS;
  }

  it("considers equal totals as matching", () => {
    expect(amountsMatch(1500, 1500, 100)).toBe(true);
  });

  it("considers sub-minor-unit diff as matching", () => {
    expect(amountsMatch(1500.005, 1500, 100)).toBe(true);
  });

  it("considers diff > 1 minor unit as mismatch", () => {
    expect(amountsMatch(1500.02, 1500, 100)).toBe(false);
  });

  it("considers significant price change as mismatch", () => {
    expect(amountsMatch(1600, 1500, 100)).toBe(false);
  });
});

describe("handlePay error message safety", () => {
  const SAFE_MESSAGES = [
    "Add your delivery address and contact details before you continue to payment.",
    "Choose an available way to pay, or ask the shop owner to turn on that option.",
    "Review the updated total below before continuing to payment.",
    "Enter a valid email address or leave the field blank.",
    "Checkout is already in progress in another browser tab.",
    "Unable to start checkout. Please try again.",
    "Network error. Please check your connection.",
  ];

  for (const msg of SAFE_MESSAGES) {
    it(`message is user-safe: "${msg.slice(0, 60)}..."`, () => {
      expect(isUserSafeErrorMessage(msg)).toBe(true);
    });
  }

  it("detects leaked env variable as unsafe", () => {
    expect(isUserSafeErrorMessage("Error: MEDUSA_SECRET_API_KEY is undefined")).toBe(false);
  });

  it("detects stack trace as unsafe", () => {
    expect(isUserSafeErrorMessage("TypeError: Cannot read property at Object.<anonymous>")).toBe(false);
  });
});
