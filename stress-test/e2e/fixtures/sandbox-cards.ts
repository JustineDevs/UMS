/**
 * Sandbox test card constants for PSP e2e flows.
 * These are public test credentials published by each payment provider.
 * Do NOT use in production.
 */

// Stripe test cards — https://docs.stripe.com/testing#cards
export const STRIPE_SUCCESS_CARD = "4242424242424242";
export const STRIPE_DECLINE_CARD = "4000000000000002";
export const STRIPE_3DS_CARD = "4000002500003155";
export const STRIPE_TEST_EXPIRY = "12/34";
export const STRIPE_TEST_CVC = "123";
export const STRIPE_TEST_ZIP = "10001";

// PayMongo test cards — https://developers.paymongo.com/docs/testing
export const PAYMONGO_SUCCESS_CARD = "5123450000000008"; // Mastercard test
export const PAYMONGO_DECLINE_CARD = "4111111111111111";
export const PAYMONGO_TEST_EXPIRY = "12/25";
export const PAYMONGO_TEST_CVC = "100";

// Maya test cards — https://developers.maya.ph/docs/testing
export const MAYA_SUCCESS_CARD = "5123456789012346";
export const MAYA_TEST_EXPIRY = "12/25";
export const MAYA_TEST_CVC = "111";

// PayPal — sandbox buyer credentials come from env (PAYPAL_SANDBOX_BUYER_EMAIL / _PASSWORD)
// Create test accounts at https://developer.paypal.com/dashboard/accounts
export function getPayPalSandboxBuyer(): { email: string; password: string } | null {
  const email = process.env.PAYPAL_SANDBOX_BUYER_EMAIL?.trim();
  const password = process.env.PAYPAL_SANDBOX_BUYER_PASSWORD?.trim();
  if (!email || !password) return null;
  return { email, password };
}
