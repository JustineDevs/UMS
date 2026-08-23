import "../runtime-logs-init";
import { type Page, type APIRequestContext, test, expect } from "@playwright/test";

import { isE2eExpectAllPsps, isE2eStrictPayments } from "../fixtures/env";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const medusaBaseURL = process.env.PLAYWRIGHT_MEDUSA_URL ?? "http://localhost:9000";

export async function enablePublicTunnelBypass(page: Page): Promise<void> {
  if (process.env.E2E_TUNNEL_BYPASS_HEADER === "1") {
    await page.route(/https:\/\/[^/]+\.loca\.lt(?:\/|$)/, async (route) => {
      await route.continue({
        headers: {
          ...route.request().headers(),
          "bypass-tunnel-reminder": "1",
        },
      });
    });
  }
}

export type PaymentProvider = "stripe" | "paypal" | "xendit" | "cod";

type PspCredentials = {
  stripe?: { testCardNumber: string; expiry: string; cvc: string };
  paypal?: { email: string; password: string };
  xendit?: { checkoutUrl?: string };
};

/**
 * Environment-based PSP configuration. Each test reads these env vars
 * to decide whether to run or skip the PSP-specific checkout.
 */
function getPspTestConfig(): {
  provider: PaymentProvider;
  configured: boolean;
  envVars: Record<string, string | undefined>;
}[] {
  const stripeKey = process.env.E2E_STRIPE_API_KEY?.trim() || process.env.STRIPE_API_KEY?.trim();
  const paypalClientId = process.env.E2E_PAYPAL_CLIENT_ID?.trim() || process.env.PAYPAL_CLIENT_ID?.trim();
  const paypalClientSecret = process.env.E2E_PAYPAL_CLIENT_SECRET?.trim() || process.env.PAYPAL_CLIENT_SECRET?.trim();
  const xenditSecretKey = process.env.E2E_XENDIT_SECRET_KEY?.trim() || process.env.XENDIT_SECRET_KEY?.trim();
  return [
    {
      provider: "stripe",
      configured: Boolean(stripeKey),
      envVars: {
        apiKey: stripeKey,
        webhookSecret: process.env.E2E_STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET,
      },
    },
    {
      provider: "paypal",
      configured: Boolean(paypalClientId && paypalClientSecret),
      envVars: {
        clientId: paypalClientId,
        clientSecret: paypalClientSecret,
      },
    },
    {
      provider: "xendit",
      configured: Boolean(xenditSecretKey),
      envVars: {
        secretKey: xenditSecretKey,
        webhookToken: process.env.E2E_XENDIT_WEBHOOK_TOKEN || process.env.XENDIT_WEBHOOK_TOKEN,
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
        `${provider}: sandbox credentials not configured. Strict mode is on (E2E_STRICT_PAYMENTS=1 or E2E_STRICT_E2E=1).`,
      );
    }
    test.skip(
      true,
      `${provider} sandbox credentials not configured (set E2E_* or provider sandbox env vars)`,
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
  options?: {
    maxCandidates?: number;
    log?: (_message: string) => void;
    shopPath?: string;
  },
): Promise<AddCatalogProductResult | null> {
  const max = options?.maxCandidates ?? 8;
  const log = options?.log ?? (() => {});
  await page.goto(`${baseURL}${options?.shopPath ?? "/shop"}`, {
    waitUntil: "load",
  });
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 30_000 });

  const cards = page.locator("[data-product-slug]");
  const slugs = await cards.evaluateAll((els) =>
    els
      .map((el) => el.getAttribute("data-product-slug")?.trim() ?? "")
      .filter(Boolean),
  );
  if (slugs.length === 0) {
    log("stress catalog: no [data-product-slug] on /shop");
    return null;
  }

  const trySlug = async (slug: string): Promise<AddCatalogProductResult | null> => {
    const res = await page.goto(`${baseURL}/shop/${slug}`, {
      waitUntil: "domcontentloaded",
    });
    if (!res || res.status() >= 400) return null;
    const btn = page.locator('[data-testid="pdp-add-to-bag"]:visible').first();
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
    await page.waitForFunction(
      () => {
        const element = document.querySelector<HTMLElement>(
          '[data-testid="pdp-add-to-bag"]',
        );
        return Boolean(element && !element.matches(":disabled"));
      },
      undefined,
      { timeout: 10_000 },
    );
    const bodyText = (await page.locator("body").innerText().catch(() => "")) as string;
    if (/out of stock|sold out|currently unavailable/i.test(bodyText)) {
      log(`stress catalog: skip ${slug} (oos/unavailable copy)`);
      return null;
    }
    // Public tunnels can finish hydration after the first click. Re-acquire the
    // control after each reload instead of clicking a detached/stale locator.
    for (let attempt = 0; attempt < 3 && !/\/cart(?:\?|$)/.test(page.url()); attempt += 1) {
      const addButton = page.locator('[data-testid="pdp-add-to-bag"]:visible').first();
      await addButton.waitFor({ state: "visible", timeout: 20_000 });
      await addButton.click();
      await page.waitForTimeout(800);
      if (!/\/cart(?:\?|$)/.test(page.url()) && attempt < 2) {
        await page.reload({ waitUntil: "domcontentloaded" });
      }
    }
    await expect(page).toHaveURL(/\/cart(?:\?|$)/, { timeout: 15_000 });
    await expect(page.getByText("Your bag is empty.")).toHaveCount(0, { timeout: 15_000 });
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

  for (const slug of slugs.slice(0, max)) {
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
async function verifyMedusaOrderExists(
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
    await expect(page).toHaveURL(/\/(track\/(?:order_|cap_)|checkout\/stripe-return)/i, {
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

  if (provider === "xendit") {
    if (strict) {
      await expectOrderConfirmation(page);
    } else {
      await expect(
        page
          .getByText(/xendit|payment|processing|confirm/i)
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
async function skipUnlessPspRegisteredInMedusa(
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
  // Card providers are intentionally available to guests; enter that explicit
  // mode so provider smoke tests do not mistake the auth gate for a PSP gap.
  await page.goto(`${baseURL}/checkout?guest=1`, { waitUntil: "load" });
  await expect(page).toHaveURL(/guest=1/);
  await expect(page.getByRole("heading", { name: /checkout/i })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Preparing checkout…")).toHaveCount(0, {
    timeout: 45_000,
  });
  const cookieDialog = page.getByRole("dialog", { name: /cookie consent/i });
  if (await cookieDialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await cookieDialog
      .getByRole("button", { name: /essential only/i })
      .evaluate((element) => (element as HTMLButtonElement).click());
  }
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
  const labelByProvider: Record<PaymentProvider, RegExp> = {
    stripe: /stripe/i,
    paypal: /paypal/i,
    xendit: /xendit/i,
    cod: /cash on delivery/i,
  };

  const byTestId = page
    .locator(`[data-testid="payment-${provider}"]:visible:not(:disabled)`)
    .first();
  if (await byTestId.isVisible({ timeout: 60_000 }).catch(() => false)) {
    await byTestId.evaluate((element) =>
      element.scrollIntoView({ block: "center", inline: "nearest" }),
    );
    await byTestId.evaluate((element) => (element as HTMLButtonElement).click());
    await expect(byTestId).toHaveAttribute("aria-checked", "true");
    return true;
  }

  const byRadioLabel = page.getByRole("radio", {
    name: labelByProvider[provider],
  });
  if (await byRadioLabel.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await byRadioLabel.click();
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
  const review = page.getByRole("button", {
    name: /reviewed the updated total/i,
  });
  const terms = page.getByTestId("checkout-terms-checkbox");
  if (await terms.isVisible({ timeout: 5_000 }).catch(() => false)) {
    if (!(await terms.isChecked())) await terms.check();
  }
  const payBtn = page.getByTestId("checkout-submit-pay");
  await expect(payBtn).toBeVisible({ timeout: 10_000 });
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (await review.isVisible().catch(() => false)) {
      await review.click();
    }
    if (await payBtn.isEnabled().catch(() => false)) {
      await payBtn.click();
      return;
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`Checkout submit did not become enabled: ${await payBtn.innerText()}`);
}

/** Medusa Stripe module uses Checkout Sessions → redirect to `checkout.stripe.com` (not Elements on our domain). */
export const STRIPE_SANDBOX_TEST_CARD_SUCCESS = "4242424242424242";
export const STRIPE_SANDBOX_TEST_CARD_DECLINE = "4000000000000002";

/**
 * Retry a failed hosted handoff only. Normal checkout navigates in the same tab
 * without requiring a second confirmation click.
 */
export async function clickContinueToStripeHostedCheckout(page: Page): Promise<void> {
  const btn = page.getByTestId("checkout-retry-payment-handoff");
  await expect(btn).toBeVisible({ timeout: 60_000 });
  await btn.click();
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 90_000 });
}

/** Accepts either direct navigation or the optional intermediate handoff UI. */
export async function ensureStripeHostedCheckout(page: Page): Promise<void> {
  if (page.url().includes("checkout.stripe.com")) return;
  const hostedContinue = page.getByTestId("checkout-retry-payment-handoff");
  const winner = await Promise.race([
    page
      .waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 })
      .then(() => "redirect" as const)
      .catch(() => null),
    expect(hostedContinue)
      .toBeVisible({ timeout: 60_000 })
      .then(() => "handoff" as const)
      .catch(() => null),
  ]);
  if (winner === "redirect" || page.url().includes("checkout.stripe.com")) return;
  if (winner === "handoff") {
    await clickContinueToStripeHostedCheckout(page);
    return;
  }
  throw new Error("Stripe checkout did not redirect or expose its handoff control");
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
    const emailLoc = frame.locator('input[type="email"], input[autocomplete="email"]').first();
    if ((await emailLoc.count()) > 0) await emailLoc.fill("e2e-test@example.com");
    const nameLoc = frame
      .locator('input[autocomplete="cc-name"], input[placeholder*="name"]')
      .first();
    if ((await nameLoc.count()) > 0) await nameLoc.fill("E2E Test Customer");
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

  const hostedEmail = page.locator('input[type="email"], input[autocomplete="email"]').first();
  if (await hostedEmail.isVisible().catch(() => false)) {
    await hostedEmail.fill("e2e-test@example.com");
  }
  const hostedName = page
    .locator('input[autocomplete="cc-name"], input[placeholder*="Full name"]')
    .first();
  if (await hostedName.isVisible().catch(() => false)) {
    await hostedName.fill("E2E Test Customer");
  }
}

/**
 * Submits payment on Stripe Hosted Checkout and waits for redirect back to the storefront.
 */
async function submitStripeHostedCheckoutAndWaitForReturn(page: Page): Promise<void> {
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

  try {
    await ensureStripeHostedCheckout(page);
    await fillStripeHostedCheckoutTestCard(page, cardNumber);
    await submitStripeHostedCheckoutAndWaitForReturn(page);
    return;
  } catch (hostedError) {
    const stripeFrame = page.frameLocator("iframe[name*='stripe']").first();
    const cardInput = stripeFrame
      .locator("[name='cardnumber'], [placeholder*='card'], input[autocomplete='cc-number']")
      .first();
    try {
      await expect(cardInput).toBeVisible({ timeout: 10_000 });
      await cardInput.fill(cardNumber);
      await stripeFrame
        .locator("[name='exp-date'], [placeholder*='MM'], input[autocomplete='cc-exp']")
        .first()
        .fill("12/30");
      await stripeFrame
        .locator("[name='cvc'], [placeholder*='CVC'], input[autocomplete='cc-csc']")
        .first()
        .fill("123");
      await page.getByRole("button", { name: /complete payment/i }).click();
      await page.waitForURL(/\/(track\/[^/]+|checkout\/stripe-return)/, { timeout: 120_000 });
      return;
    } catch {
      throw new Error(
        `Could not find Stripe Hosted Checkout or embedded card form: ${
          hostedError instanceof Error ? hostedError.message : "checkout did not become ready"
        }`,
      );
    }
  }
}

/**
 * Checks that the order confirmation page (or success state) appears
 * after a successful payment flow.
 */
export async function expectOrderConfirmation(page: Page): Promise<void> {
  await expect(
    page
      .getByRole("heading", { name: /order.*confirm|thank you|success/i })
      .or(page.getByRole("heading", { name: /order.*track|track.*order|status/i }))
      .or(page.getByRole("heading", { name: /^order\s+\d+/i }))
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
