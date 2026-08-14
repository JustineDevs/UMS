import { createHash } from "crypto";

/** Version bump when rule definitions change (audit trail). */
export const OMNICHANNEL_POLICY_VERSION = 1 as const;

export type CommerceChannel = "web" | "pos";

export type PolicyEvaluationResult = {
  allowed: boolean;
  policyVersion: typeof OMNICHANNEL_POLICY_VERSION;
  /** Stable id for logs: sha256(version + channel + inputs). */
  decisionId: string;
  channel: CommerceChannel;
  violations: string[];
};

function hashDecision(parts: string[]): string {
  const h = createHash("sha256");
  h.update(`v${OMNICHANNEL_POLICY_VERSION}`);
  for (const p of parts) h.update("|").update(p);
  return h.digest("hex").slice(0, 32);
}

function posRequiresOpenShift(): boolean {
  return process.env.POS_SALE_REQUIRES_OPEN_SHIFT === "true";
}

/**
 * Deterministic rules for web checkout: Medusa remains inventory SoR; caller must pass stockVerified after server-side Medusa read.
 */
export function evaluateWebCheckoutPolicy(input: {
  stockVerified: boolean;
}): PolicyEvaluationResult {
  const violations: string[] = [];
  if (!input.stockVerified) {
    violations.push("web_checkout_requires_server_stock_verification");
  }
  const decisionId = hashDecision([
    "web",
    String(input.stockVerified),
  ]);
  return {
    allowed: violations.length === 0,
    policyVersion: OMNICHANNEL_POLICY_VERSION,
    decisionId,
    channel: "web",
    violations,
  };
}

/**
 * POS path: optional enforcement of an open shift (register-grade) via POS_SALE_REQUIRES_OPEN_SHIFT=true.
 */
export function evaluatePosSalePolicy(input: {
  stockVerified: boolean;
  hasOpenShift: boolean;
  shiftIdProvided: boolean;
}): PolicyEvaluationResult {
  const violations: string[] = [];
  if (!input.stockVerified) {
    violations.push("pos_sale_requires_server_stock_verification");
  }
  if (posRequiresOpenShift()) {
    if (!input.shiftIdProvided) {
      violations.push("pos_sale_requires_shift_id_when_shift_policy_enabled");
    }
    if (!input.hasOpenShift) {
      violations.push("pos_sale_requires_open_shift");
    }
  }
  const decisionId = hashDecision([
    "pos",
    String(input.stockVerified),
    String(input.hasOpenShift),
    String(input.shiftIdProvided),
    String(posRequiresOpenShift()),
  ]);
  return {
    allowed: violations.length === 0,
    policyVersion: OMNICHANNEL_POLICY_VERSION,
    decisionId,
    channel: "pos",
    violations,
  };
}
