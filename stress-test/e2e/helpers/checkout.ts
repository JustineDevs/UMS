import "../runtime-logs-init";
import { type Page, type APIRequestContext, test, expect } from "@playwright/test";

import { isE2eExpectAllPsps, isE2eStrictPayments } from "../fixtures/env";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const medusaBaseURL = process.env.PLAYWRIGHT_MEDUSA_URL ?? "http://localhost:9000";

export type PaymentProvider = "stripe" | "paypal" | "paymongo" | "maya" | "cod";

export type PspCredentials = {
  stripe?: { testCardNumber: string; expiry: string; cvc: string };
  paypal?: { email: string; password: string };
  paymongo?: { testCardNumber: string; expiry: string; cvc: string };
  maya?: { testCardNumber: string; expiry: string; cvc: string };
};

/**
 * Environment-based PSP configuration. Each test reads these env vars
 * to decide whether to run or skip the PSP-specific checkout.
 */
export function getPspTestConfig(): {
  provider: PaymentProvider;
  configured: boolean;
  envVars: Record<string, string | undefined>;
}[] {
  return [
    {
      provider: "stripe",
      configured: Boolean(process.env.E2E_STRIPE_API_KEY?.trim()),
      envVars: {
        apiKey: process.env.E2E_STRIPE_API_KEY,
        webhookSecret: process.env.E2E_STRIPE_WEBHOOK_SECRET,
      },
    },
    {
      provider: "paypal",
      configured: Boolean(
        process.env.E2E_PAYPAL_CLIENT_ID?.trim() &&
          process.env.E2E_PAYPAL_CLIENT_SECRET?.trim(),
      ),
      envVars: {
        clientId: process.env.E2E_PAYPAL_CLIENT_ID,
        clientSecret: process.env.E2E_PAYPAL_CLIENT_SECRET,
      },
    },
    {
      provider: "paymongo",
      configured: Boolean(process.env.E2E_PAYMONGO_SECRET_KEY?.trim()),
      envVars: {
        secretKey: process.env.E2E_PAYMONGO_SECRET_KEY,
        webhookSecret: process.env.E2E_PAYMONGO_WEBHOOK_SECRET,
      },
    },
    {
      provider: "maya",
      configured: Boolean(process.env.E2E_MAYA_SECRET_KEY?.trim()),
      envVars: {
        secretKey: process.env.E2E_MAYA_SECRET_KEY,
      },
    },
    {
      provider: "cod",
      configured: true,
      envVars: {},
    },
  ];
}

export function skipUnlessPspConfigured(provider: PaymentProvider): void {
  const config = getPspTestConfig().find((c) => c.provider === provider);
  if (!config?.configured) {
    if (isE2eStrictPayments()) {
      throw new Error(
        `${provider}: E2E credentials not configured. Strict mode is on (E2E_STRICT_PAYMENTS=1 or E2E_STRICT_E2E=1).`,
      );
    }
    test.skip(
      true,
      `${provider} E2E credentials not configured (set E2E_${provider.toUpperCase()}_* env vars)`,
    );
  }
}

/**
 * When E2E_EXPECT_ALL_PSPS=1, every PSP Medusa reports as configured must have sandbox E2E_* env set.
 */
export async function assertExpectAllPspsMatchMedusa(
  request: APIRequestContext,
): Promise<void> {
  if (!isE2eExpectAllPsps()) return;
  const res = await request.get(`${medusaBaseURL}/admin/payment-health`, {
    failOnStatusCode: false,
  });
  if (!res.ok()) {
    if (isE2eStrictPayments()) {
      throw new Error(
        `E2E_EXPECT_ALL_PSPS: GET /admin/payment-health failed (${res.status()}).`,
      );
    }
    return;
  }
  const body = (await res.json()) as {
    providers?: Record<string, { configured: boolean }>;
  };
  for (const entry of getPspTestConfig()) {
    if (entry.provider === "cod") continue;
    const inMedusa = body.providers?.[entry.provider]?.configured === true;
    if (inMedusa && !entry.configured) {
      throw new Error(
        `E2E_EXPECT_ALL_PSPS: Medusa has "${entry.provider}" enabled but matching E2E sandbox credentials are missing.`,
      );
    }
  }
}

export type AddCatalogProductResult = { slug: string; productTitle?: string };

/**
 * Walks /shop [data-product-slug] cards, opens PDPs, skips sign-in / disabled / OOS-looking pages,
 * clicks "Add to bag" when the customer is already authenticated.
 */
export async function navigateToShopAndAddPreferredCatalogProduct(
  page: Page,
  options?: { maxCandidates?: number; log?: (message: string) => void },
): Promise<AddCatalogProductResult | null> {
  const max = options?.maxCandidates ?? 8;
  const log = options?.log ?? (() => {});
  await page.goto(`${baseURL}/shop`, { waitUntil: "load" });
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 30_000 });

  const cards = page.locator("[data-product-slug]");
  const n = await cards.count();
  if (n === 0) {
    log("stress catalog: no [data-product-slug] on /shop");
    return null;
  }

  const trySlug = async (slug: string): Promise<AddCatalogProductResult | null> => {
    const res = await page.goto(`${baseURL}/shop/${slug}`, {
      waitUntil: "domcontentloaded",
    });
    if (!res || res.status() >= 400) return null;
    const btn = page.getByTestId("pdp-add-to-bag");
    await expect(btn).toBeVisible({ timeout: 20_000 });
    const label = ((await btn.innerText().catch(() => "")) as string).trim();
    log(`stress catalog: /shop/${slug} CTA "${label.slice(0, 72)}"`);
    if (/sign in to add/i.test(label)) {
      log(`stress catalog: skip ${slug} (needs storefront sign-in)`);
      return null;
    }
    if (await btn.isDisabled()) {
      log(`stress catalog: skip ${slug} (add control disabled)`);
      return null;
    }
    const bodyText = (await page.locator("body").innerText().catch(() => "")) as string;
    if (/out of stock|sold out|currently unavailable/i.test(bodyText)) {
      log(`stress catalog: skip ${slug} (oos/unavailable copy)`);
      return null;
    }
    await btn.click();
    await page.waitForTimeout(800);
    if (page.url().includes("/sign-in")) {
      log(`stress catalog: skip ${slug} (redirected to sign-in)`);
      return null;
    }
    const title = await page
      .getByRole("heading", { level: 1 })
      .first()
      .innerText()
      .catch(() => "");
    return { slug, productTitle: title.trim() || undefined };
  };

  for (let i = 0; i < Math.min(n, max); i++) {
    const slugRaw = await cards.nth(i).getAttribute("data-product-slug");
    const slug = slugRaw?.trim();
    if (!slug) continue;
    const got = await trySlug(slug);
    if (got) {
      log(`stress catalog: selected ${slug}${got.productTitle ? ` (${got.productTitle})` : ""}`);
      return got;
    }
  }
  return null;
}

export async function getStressRunProviders(
  request: APIRequestContext,
): Promise<PaymentProvider[]> {
  await assertExpectAllPspsMatchMedusa(request);
  const out: PaymentProvider[] = [];
  for (const entry of getPspTestConfig()) {
    if (entry.provider === "cod") {
      if (process.env.E2E_STRESS_EXCLUDE_COD === "1") continue;
      out.push("cod");
      continue;
    }
    if (!entry.configured) continue;
    out.push(entry.provider);
  }
  if (out.length === 0 && isE2eStrictPayments()) {
    throw new Error(
      "E2E strict payments: no providers to run (configure E2E_STRIPE_API_KEY, E2E_PAYPAL_*, … or unset strict).",
    );
  }
  return out;
}

/** Optional: confirm Medusa Admin API sees the order (needs MEDUSA_SECRET_API_KEY or E2E_MEDUSA_ADMIN_SECRET). */
export async function verifyMedusaOrderExists(
  request: APIRequestContext,
  orderId: string,
): Promise<boolean> {
  if (process.env.E2E_VERIFY_MEDUSA_ORDER !== "1") return false;
  const secret =
    process.env.E2E_MEDUSA_ADMIN_SECRET?.trim() ??
    process.env.MEDUSA_SECRET_API_KEY?.trim();
  if (!secret || !orderId.startsWith("order_")) return false;
  const auth = `Basic ${Buffer.from(`${secret}:`, "utf8").toString("base64")}`;
  const res = await request.get(
    `${medusaBaseURL}/admin/orders/${encodeURIComponent(orderId)}`,
    { headers: { Authorization: auth }, failOnStatusCode: false },
  );
  return res.ok();
}

/**
 * After sandbox payment, assert confirmation UI and optionally Medusa order row.
 */
export async function verifyPostPaymentSuccess(
  page: Page,
  request: APIRequestContext,
  provider: PaymentProvider,
): Promise<void> {
  const strict = isE2eStrictPayments();

  if (provider === "stripe" || provider === "cod") {
    await expectOrderConfirmation(page);
    await expect(page).toHaveURL(/\/(track\/order_|checkout\/stripe-return)/i, {
      timeout: strict ? 60_000 : 30_000,
    });
    const m = page.url().match(/(order_[a-z0-9]+)/i);
    if (m?.[1]) {
      const ok = await verifyMedusaOrderExists(request, m[1]);
      if (strict && process.env.E2E_VERIFY_MEDUSA_ORDER === "1") {
        expect(ok, `Medusa admin should return order ${m[1]}`).toBe(true);
      }
    }
    return;
  }

  if (provider === "paypal") {
    const onPaypal = /paypal\.com/i.test(page.url());
    const onTrack = /\/track\/order_/i.test(page.url());
    if (strict) {
      await expect(
        page
          .getByTestId("order-confirmation")
          .or(page.getByRole("heading", { name: /order|thank you|success/i }))
          .or(page.getByText(/order.*confirm/i)),
      ).toBeVisible({ timeout: 120_000 });
    } else {
      expect(onPaypal || onTrack).toBeTruthy();
    }
    return;
  }

  if (provider === "paymongo" || provider === "maya") {
    if (strict) {
      await expectOrderConfirmation(page);
    } else {
      await expect(
        page
          .getByText(/paymongo|maya|payment|processing|confirm/i)
          .first()
          .or(page.getByTestId("order-confirmation"))
          .or(page.locator("[data-order-id]")),
      ).toBeVisible({ timeout: 45_000 });
    }
  }
}

/**
 * Verifies Medusa has the payment provider registered via the admin health endpoint.
 */
export async function skipUnlessPspRegisteredInMedusa(
  request: APIRequestContext,
  provider: PaymentProvider,
): Promise<void> {
  try {
    const res = await request.get(`${medusaBaseURL}/admin/payment-health`, {
      failOnStatusCode: false,
    });
    if (!res.ok()) {
      test.skip(true, `Medusa payment-health endpoint not available (${res.status()})`);
      return;
    }
    const body = (await res.json()) as {
      providers?: Record<string, { configured: boolean }>;
    };
    if (!body.providers?.[provider]?.configured) {
      test.skip(true, `${provider} not configured in Medusa`);
    }
  } catch {
    test.skip(true, "Medusa not reachable for payment-health check");
  }
}

export async function navigateToShopAndAddFirstProduct(page: Page): Promise<void> {
  const preferred = await navigateToShopAndAddPreferredCatalogProduct(page, {
    maxCandidates: 4,
  });
  if (preferred) return;

  await page.goto(`${baseURL}/shop`);
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 30_000 });

  const productLink = page.locator('a[href^="/shop/"]').first();
  await expect(productLink).toBeVisible({ timeout: 15_000 });
  await productLink.click();

  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 30_000 });

  const addToCartBtn = page.getByRole("button", { name: /add to (cart|bag)/i });
  if (await addToCartBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await addToCartBtn.click();
    await page.waitForTimeout(1_000);
  }
}

export async function navigateToCheckout(page: Page): Promise<void> {
  await page.goto(`${baseURL}/checkout`);
  await expect(
    page.getByRole("heading", { name: /checkout/i }),
  ).toBeVisible({ timeout: 30_000 });
}

export async function fillCheckoutShippingInfo(
  page: Page,
  info?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    phone?: string;
  },
): Promise<void> {
  const defaults = {
    email: "e2e-test@example.com",
    firstName: "E2E",
    lastName: "Tester",
    address: "123 Test Street",
    city: "Manila",
    postalCode: "1000",
    phone: "+639171234567",
    ...info,
  };

  const emailInput = page.getByLabel(/email/i).first();
  if (await emailInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await emailInput.fill(defaults.email);
  }

  const firstNameInput = page.getByLabel(/first name/i).first();
  if (await firstNameInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await firstNameInput.fill(defaults.firstName);
  }

  const lastNameInput = page.getByLabel(/last name/i).first();
  if (await lastNameInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await lastNameInput.fill(defaults.lastName);
  }

  const addressInput = page.getByLabel(/address/i).first();
  if (await addressInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await addressInput.fill(defaults.address);
  }

  const cityInput = page.getByLabel(/city/i).first();
  if (await cityInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await cityInput.fill(defaults.city);
  }

  const postalInput = page.getByLabel(/postal|zip/i).first();
  if (await postalInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await postalInput.fill(defaults.postalCode);
  }

  const phoneInput = page.getByLabel(/phone/i).first();
  if (await phoneInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await phoneInput.fill(defaults.phone);
  }
}

/**
 * Selects a payment provider on the checkout page if the option exists.
 * Storefront checkout uses toggle-style rows (`button[role="radio"]`) with
 * `data-testid="payment-{provider}"` (lowercase). Legacy radio inputs are still supported.
 */
export async function selectPaymentProvider(
  page: Page,
  provider: PaymentProvider,
): Promise<boolean> {
  const byTestId = page.getByTestId(`payment-${provider}`);
  if (await byTestId.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await byTestId.click();
    return true;
  }

  const byDataProvider = page.locator(`[data-provider="${provider}"]`).first();
  if (await byDataProvider.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await byDataProvider.click();
    return true;
  }

  const legacyInput = page.locator(`input[value="${provider}"]`).first();
  if (await legacyInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await legacyInput.click();
    return true;
  }

  return false;
}

/**
 * Clicks the final pay/submit button on checkout.
 */
export async function clickPayButton(page: Page): Promise<void> {
  const payBtn = page.getByTestId("checkout-submit-pay");
  await expect(payBtn).toBeVisible({ timeout: 10_000 });
  await payBtn.click();
}

/** Medusa Stripe module uses Checkout Sessions → redirect to `checkout.stripe.com` (not Elements on our domain). */
export const STRIPE_SANDBOX_TEST_CARD_SUCCESS = "4242424242424242";
export const STRIPE_SANDBOX_TEST_CARD_DECLINE = "4000000000000002";

/**
 * After "Continue to payment", the storefront shows "Continue to Stripe" which sends the
 * browser to Stripe Hosted Checkout. Call this after {@link clickPayButton} when that button appears.
 */
export async function clickContinueToStripeHostedCheckout(page: Page): Promise<void> {
  const btn = page.getByTestId("checkout-continue-payment");
  await expect(btn).toBeVisible({ timeout: 60_000 });
  await btn.click();
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 90_000 });
}

/**
 * Fills Stripe's documented test card on the hosted Checkout page (test mode only).
 * @see https://docs.stripe.com/testing#cards
 */
export async function fillStripeHostedCheckoutTestCard(
  page: Page,
  cardNumber: string,
): Promise<void> {
  await page
    .locator('iframe[src*="stripe"], iframe[name*="stripe"]')
    .first()
    .waitFor({ state: "attached", timeout: 45_000 })
    .catch(() => {});

  let filled = false;
  for (const frame of page.frames()) {
    const url = frame.url();
    if (!url.includes("stripe") && !url.includes("js.stripe.com")) continue;
    const numberLoc = frame.locator(
      'input[autocomplete="cc-number"], input[name="cardnumber"], input[data-elements-stable-field-name="cardNumber"]',
    );
    if ((await numberLoc.count()) === 0) continue;
    await numberLoc.first().fill(cardNumber, { timeout: 20_000 });
    const expLoc = frame.locator(
      'input[autocomplete="cc-exp"], input[name="exp-date"], input[data-elements-stable-field-name="cardExpiry"]',
    );
    if ((await expLoc.count()) > 0) {
      await expLoc.first().fill("12 / 34");
    }
    const cvcLoc = frame.locator(
      'input[autocomplete="cc-csc"], input[name="cvc"], input[data-elements-stable-field-name="cardCvc"]',
    );
    if ((await cvcLoc.count()) > 0) {
      await cvcLoc.first().fill("123");
    }
    filled = true;
    break;
  }
  if (!filled) {
    const anyNumber = page.locator(
      'input[autocomplete="cc-number"]',
    );
    await expect(anyNumber.first()).toBeVisible({ timeout: 30_000 });
    await anyNumber.first().fill(cardNumber);
    const exp = page.locator('input[autocomplete="cc-exp"]').first();
    if (await exp.isVisible().catch(() => false)) await exp.fill("12 / 34");
    const cvc = page.locator('input[autocomplete="cc-csc"]').first();
    if (await cvc.isVisible().catch(() => false)) await cvc.fill("123");
  }
}

/**
 * Submits payment on Stripe Hosted Checkout and waits for redirect back to the storefront.
 */
export async function submitStripeHostedCheckoutAndWaitForReturn(page: Page): Promise<void> {
  const pay = page
    .getByTestId("hosted-payment-submit-button")
    .or(page.getByRole("button", { name: /^pay\b/i }))
    .first();
  await expect(pay).toBeVisible({ timeout: 30_000 });
  await pay.click();
  await page.waitForURL(/\/(track\/[^/]+|checkout\/stripe-return)/, { timeout: 120_000 });
}

/**
 * Full path for Medusa Stripe Checkout Session: start checkout on storefront, pay on stripe.com with a test card.
 */
export async function payWithStripeSandboxCard(
  page: Page,
  cardNumber: string,
): Promise<void> {
  await clickPayButton(page);

  const hostedContinue = page.getByTestId("checkout-continue-payment");
  if (await hostedContinue.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await clickContinueToStripeHostedCheckout(page);
    await fillStripeHostedCheckoutTestCard(page, cardNumber);
    await submitStripeHostedCheckoutAndWaitForReturn(page);
    return;
  }

  const stripeFrame = page.frameLocator("iframe[name*='stripe']").first();
  const cardInput = stripeFrame
    .locator("[name='cardnumber'], [placeholder*='card'], input[autocomplete='cc-number']")
    .first();
  if (await cardInput.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await cardInput.fill(cardNumber);
    const expiryInput = stripeFrame
      .locator("[name='exp-date'], [placeholder*='MM'], input[autocomplete='cc-exp']")
      .first();
    await expiryInput.fill("12/30");
    const cvcInput = stripeFrame
      .locator("[name='cvc'], [placeholder*='CVC'], input[autocomplete='cc-csc']")
      .first();
    await cvcInput.fill("123");
    await page.getByRole("button", { name: /complete payment/i }).click();
    await page.waitForURL(/\/(track\/[^/]+|checkout\/stripe-return)/, { timeout: 120_000 });
    return;
  }

  throw new Error(
    "Could not find Stripe Hosted Checkout or embedded card form. Is Stripe selected and Medusa returning a Checkout Session URL?",
  );
}

/**
 * Checks that the order confirmation page (or success state) appears
 * after a successful payment flow.
 */
export async function expectOrderConfirmation(page: Page): Promise<void> {
  await expect(
    page
      .getByRole("heading", { name: /order.*confirm|thank you|success/i })
      .or(page.getByTestId("order-confirmation"))
      .or(page.locator("[data-order-id]")),
  ).toBeVisible({ timeout: 60_000 });
}

/**
 * Extract `order_*` ID from current URL (track page or stripe-return).
 */
export function extractOrderIdFromUrl(url: string): string | null {
  const m = url.match(/(order_[a-z0-9]+)/i);
  return m?.[1] ?? null;
}

/**
 * Navigate to the tracking page for an order and verify basic content renders.
 * Returns false if tracking is not available (no TRACKING_HMAC_SECRET in dev, etc.).
 */
export async function verifyTrackingPageContent(
  page: Page,
  orderId: string,
): Promise<boolean> {
  if (!orderId.startsWith("order_")) return false;
  const trackUrl = `${baseURL}/track/${encodeURIComponent(orderId)}`;
  const res = await page.goto(trackUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  if (!res || res.status() >= 400) return false;
  const heading = page.getByRole("heading").first();
  await expect(heading).toBeVisible({ timeout: 15_000 });
  const bodyText = (await page.locator("body").innerText().catch(() => "")) as string;
  const hasOrderContent =
    /order|tracking|status|pending|paid|shipped|delivered/i.test(bodyText);
  return hasOrderContent;
}

/**
 * Verify admin can see the order via API and optionally by navigating admin UI.
 * Requires `E2E_VERIFY_ADMIN_ORDER=1` + admin auth env.
 */
export async function verifyAdminOrderVisibility(
  request: APIRequestContext,
  orderId: string,
): Promise<{ apiVisible: boolean; uiChecked: boolean }> {
  const result = { apiVisible: false, uiChecked: false };
  if (process.env.E2E_VERIFY_ADMIN_ORDER !== "1") return result;
  result.apiVisible = await verifyMedusaOrderExists(request, orderId);
  return result;
}
