export type PosReturnReason = string;

export type PosReturnRequest = {
  orderId: string;
  lineItems: Array<{
    lineItemId: string;
    quantity: number;
    reason: PosReturnReason;
    note?: string;
  }>;
  staffId: string;
  storeId: string;
  refundMethod: "original_payment" | "store_credit" | "cash";
};

export type PosExchangeRequest = {
  orderId: string;
  returnLineItems: Array<{
    lineItemId: string;
    quantity: number;
    reason: PosReturnReason;
  }>;
  newLineItems: Array<{
    variantId: string;
    quantity: number;
  }>;
  staffId: string;
  storeId: string;
  priceDifferenceHandling: "charge_customer" | "refund_difference" | "absorb";
};

export type ManagerOverride = {
  id: string;
  action: string;
  staffId: string;
  managerId: string;
  reason: string;
  overrideType: "discount" | "return_window" | "price_match" | "void" | "refund_limit";
  originalValue?: string;
  overriddenValue?: string;
  timestamp: string;
  storeId: string;
};

export type OverrideLimit = {
  overrideType: ManagerOverride["overrideType"];
  maxAmountMinor?: number;
  maxPercentage?: number;
  requiresManagerPin: boolean;
  requiresReason: boolean;
};

export const OVERRIDE_LIMITS: OverrideLimit[] = [
  { overrideType: "discount", maxPercentage: 50, requiresManagerPin: true, requiresReason: true },
  { overrideType: "return_window", requiresManagerPin: true, requiresReason: true },
  { overrideType: "price_match", maxPercentage: 30, requiresManagerPin: true, requiresReason: true },
  { overrideType: "void", requiresManagerPin: true, requiresReason: true },
  { overrideType: "refund_limit", maxAmountMinor: 500_00, requiresManagerPin: true, requiresReason: true },
];

export function validateOverride(
  overrideType: ManagerOverride["overrideType"],
  amountMinor?: number,
  percentage?: number,
): { valid: boolean; reason?: string } {
  const limit = OVERRIDE_LIMITS.find((l) => l.overrideType === overrideType);
  if (!limit) return { valid: false, reason: "Override type not recognized" };

  if (limit.maxAmountMinor !== undefined && amountMinor !== undefined) {
    if (amountMinor > limit.maxAmountMinor) {
      return { valid: false, reason: `Exceeds max amount: ${limit.maxAmountMinor / 100}` };
    }
  }

  if (limit.maxPercentage !== undefined && percentage !== undefined) {
    if (percentage > limit.maxPercentage) {
      return { valid: false, reason: `Exceeds max percentage: ${limit.maxPercentage}%` };
    }
  }

  return { valid: true };
}

export function isWithinReturnWindow(orderDate: string, windowDays = 7): boolean {
  const orderMs = new Date(orderDate).getTime();
  const nowMs = Date.now();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return nowMs - orderMs <= windowMs;
}

export function calculateExchangePriceDifference(
  returnTotalMinor: number,
  newTotalMinor: number,
): { amount: number; direction: "charge" | "refund" | "even" } {
  const diff = newTotalMinor - returnTotalMinor;
  if (diff > 0) return { amount: diff, direction: "charge" };
  if (diff < 0) return { amount: Math.abs(diff), direction: "refund" };
  return { amount: 0, direction: "even" };
}
