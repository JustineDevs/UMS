/**
 * Resolve customer email for loyalty redemption from cart graph rows.
 * Used by the store loyalty route and covered by unit tests.
 */
export type LoyaltyCartRow = {
  email?: string | null;
  customer_id?: string | null;
  customer?: { email?: string | null };
};

export type CustomerEmailRow = {
  email?: string | null;
};

export function emailFromCartRow(row: LoyaltyCartRow | undefined): string {
  return String(row?.customer?.email ?? row?.email ?? "")
    .trim()
    .toLowerCase();
}

/**
 * When cart email is empty, returns customer id for a follow-up customer query.
 */
export function needsCustomerEmailLookup(row: LoyaltyCartRow | undefined): {
  lookupCustomerId: string | null;
} {
  const direct = emailFromCartRow(row);
  if (direct.includes("@")) {
    return { lookupCustomerId: null };
  }
  const cid =
    typeof row?.customer_id === "string" && row.customer_id.trim()
      ? row.customer_id.trim()
      : null;
  return { lookupCustomerId: cid };
}

export function emailFromCustomerRow(
  row: CustomerEmailRow | undefined,
): string {
  return String(row?.email ?? "")
    .trim()
    .toLowerCase();
}
