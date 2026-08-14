/**
 * Sandbox test card constants for PSP e2e flows.
 * These are public test credentials published by each payment provider.
 * Do NOT use in production.
 */

// Stripe test cards — https://docs.stripe.com/testing#cards
export const STRIPE_SUCCESS_CARD = "4242424242424242";
export const STRIPE_DECLINE_CARD = "4000000000000002";
const STRIPE_3DS_CARD = "4000002500003155";
const STRIPE_TEST_EXPIRY = "12/34";
const STRIPE_TEST_CVC = "123";
const STRIPE_TEST_ZIP = "10001";

// PayPal — sandbox buyer credentials come from env (PAYPAL_SANDBOX_BUYER_EMAIL / _PASSWORD)
// Create test accounts at https://developer.paypal.com/dashboard/accounts
export function getPayPalSandboxBuyer(): { email: string; password: string } | null {
  const email = process.env.PAYPAL_SANDBOX_BUYER_EMAIL?.trim();
  const password = process.env.PAYPAL_SANDBOX_BUYER_PASSWORD?.trim();
  if (!email || !password) return null;
  return { email, password };
}
