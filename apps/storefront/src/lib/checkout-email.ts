export type CheckoutEmailResolution =
  | { ok: true; email: string }
  | { ok: false; error: "account_email_mismatch" | "missing_email" };

export function resolveCheckoutEmail(
  sessionEmail: string | null | undefined,
  requestedEmail: string | null | undefined,
): CheckoutEmailResolution {
  const accountEmail = sessionEmail?.trim().toLowerCase() ?? "";
  const checkoutEmail = requestedEmail?.trim().toLowerCase() ?? "";
  if (accountEmail && checkoutEmail && accountEmail !== checkoutEmail) {
    return { ok: false, error: "account_email_mismatch" };
  }
  const email = accountEmail || checkoutEmail;
  return email ? { ok: true, email } : { ok: false, error: "missing_email" };
}
