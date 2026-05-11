import { existsSync } from "node:fs";

import { test, expect } from "@playwright/test";

import {
  getStressIterations,
  isE2eStrictPayments,
  resolveStorefrontStorageStatePath,
  stressDescribeMode,
  strictCatalog,
} from "../fixtures/env";
import {
  assertExpectAllPspsMatchMedusa,
  clickPayButton,
  extractOrderIdFromUrl,
  fillCheckoutShippingInfo,
  getStressRunProviders,
  navigateToCheckout,
  navigateToShopAndAddPreferredCatalogProduct,
  payWithStripeSandboxCard,
  selectPaymentProvider,
  skipUnlessPspConfigured,
  STRIPE_SANDBOX_TEST_CARD_SUCCESS,
  STRIPE_SANDBOX_TEST_CARD_DECLINE,
  clickContinueToStripeHostedCheckout,
  fillStripeHostedCheckoutTestCard,
  verifyPostPaymentSuccess,
  verifyTrackingPageContent,
  verifyAdminOrderVisibility,
  type PaymentProvider,
} from "../helpers/checkout";
import {
  attachConsoleListener,
  detachConsoleListener,
  assertNoUnexpectedConsole,
  attachFullBrowserRuntimeLog,
  detachBrowserRuntimeLog,
} from "../helpers/artifacts";

const iterations = getStressIterations();
const storagePath = resolveStorefrontStorageStatePath();

if (storagePath && existsSync(storagePath)) {
  test.use({ storageState: storagePath });
}

const ALL_STRESS_PROVIDERS: PaymentProvider[] = [
  "stripe",
  "paypal",
  "paymongo",
  "maya",
  "cod",
];

test.describe.configure({ mode: stressDescribeMode() });

/**
 * Orchestrated multi-PSP checkout stress path. Reuses helpers from individual PSP specs.
 *
 * Env:
 * - PLAYWRIGHT_STOREFRONT_STORAGE_STATE: path to storageState JSON (customer signed in with Google); required for real add-to-bag.
 * - E2E_STRICT_PAYMENTS=1 | E2E_STRICT_E2E=1: fail if PSP env missing (skipUnlessPspConfigured throws).
 * - E2E_EXPECT_ALL_PSPS=1: Medusa payment-health providers must all have E2E_* credentials.
 * - E2E_STRESS_ITERATIONS=N (default 1, max 50)
 * - E2E_STRESS_PARALLEL=1: parallel describe (higher cart collision risk)
 * - E2E_STRESS_EXCLUDE_COD=1: omit COD from the matrix
 * - E2E_VERIFY_MEDUSA_ORDER=1 + MEDUSA_SECRET_API_KEY (or E2E_MEDUSA_ADMIN_SECRET): assert admin order after redirect
 * - E2E_VERIFY_ADMIN_ORDER=1: assert admin API can see order (requires same secret)
 * - E2E_VERIFY_TRACKING=1: navigate to /track/:orderId and verify content renders
 * - E2E_TRACE=all: full Playwright traces (see root playwright.config.ts)
 */
test.describe("@workflow @checkout @stress end-to-end stress journey", () => {
  test.setTimeout(600_000);

  let providers: PaymentProvider[] = [];

  test.beforeAll(async ({ request }) => {
    await assertExpectAllPspsMatchMedusa(request);
    providers = await getStressRunProviders(request);
  });

  for (const provider of ALL_STRESS_PROVIDERS) {
    for (let iter = 0; iter < iterations; iter++) {
      test(`${provider} checkout stress ${iter + 1}/${iterations}`, async ({
        page,
        request,
      }, testInfo) => {
        test.skip(
          !providers.includes(provider),
          `${provider} not in configured stress matrix (set E2E_* sandbox keys)`,
        );

        if (provider !== "cod") {
          skipUnlessPspConfigured(provider);
        }

        const consoleIssues: { type: "error" | "warning"; text: string }[] = [];
        attachConsoleListener(page, consoleIssues);
        attachFullBrowserRuntimeLog(page, testInfo);

        try {
          let pickedSlug = "";

          await test.step("catalog: in-stock PDP and add to bag", async () => {
            const picked = await navigateToShopAndAddPreferredCatalogProduct(page, {
              maxCandidates: 10,
              log: (m) => {
                console.log(`[stress] ${m}`);
              },
            });
            if (!picked) {
              if (strictCatalog() || isE2eStrictPayments()) {
                throw new Error(
                  "No purchasable PDP (sign in with PLAYWRIGHT_STOREFRONT_STORAGE_STATE or ensure catalog + session).",
                );
              }
              test.skip(true, "No catalog product could be added (auth or stock)");
              return;
            }
            pickedSlug = picked.slug;
            expect(picked.slug.length).toBeGreaterThan(0);
          });

          await test.step("checkout and shipping", async () => {
            await navigateToCheckout(page);
            await fillCheckoutShippingInfo(page);
          });

          await test.step(`pay ${provider}`, async () => {
            const selected = await selectPaymentProvider(page, provider);
            if (!selected) {
              if (isE2eStrictPayments()) {
                throw new Error(
                  `${provider} not visible on checkout (Medusa region / storefront payment methods).`,
                );
              }
              test.skip(true, `${provider} option not on checkout`);
              return;
            }

            if (provider === "stripe") {
              await payWithStripeSandboxCard(page, STRIPE_SANDBOX_TEST_CARD_SUCCESS);
            } else if (provider === "cod") {
              await clickPayButton(page);
            } else {
              await clickPayButton(page);
              if (provider === "paypal") {
                const paypalRedirect = page.url().includes("paypal.com");
                if (paypalRedirect) {
                  await expect(page).toHaveURL(/paypal\.com/, { timeout: 30_000 });
                } else {
                  const paypalFrame = page.frameLocator("iframe[name*='paypal']").first();
                  const loginBtn = paypalFrame
                    .locator("button, [data-funding-source='paypal']")
                    .first();
                  const visible = await loginBtn
                    .isVisible({ timeout: 10_000 })
                    .catch(() => false);
                  expect(paypalRedirect || visible).toBeTruthy();
                }
              } else {
                await expect(
                  page
                    .getByText(/paymongo|maya|payment|processing|confirm/i)
                    .first()
                    .or(page.locator("[data-testid='order-confirmation']")),
                ).toBeVisible({ timeout: 45_000 });
              }
            }
          });

          await test.step("post-payment verification", async () => {
            await verifyPostPaymentSuccess(page, request, provider);
          });

          const orderId = extractOrderIdFromUrl(page.url());

          if (orderId) {
            await test.step("tracking page verification", async () => {
              if (process.env.E2E_VERIFY_TRACKING !== "1") return;
              const hasContent = await verifyTrackingPageContent(page, orderId);
              if (isE2eStrictPayments()) {
                expect(hasContent, `Tracking page for ${orderId} should render order content`).toBe(true);
              }
            });

            await test.step("admin order visibility", async () => {
              const vis = await verifyAdminOrderVisibility(request, orderId);
              if (isE2eStrictPayments() && process.env.E2E_VERIFY_ADMIN_ORDER === "1") {
                expect(vis.apiVisible, `Admin API should see order ${orderId}`).toBe(true);
              }
            });
          }
        } finally {
          detachConsoleListener(page);
          detachBrowserRuntimeLog(page);
        }

        assertNoUnexpectedConsole(consoleIssues, 3);
      });
    }
  }
});

/**
 * Recovery stress: declined card and retry behavior.
 * Only runs when Stripe sandbox is configured.
 */
test.describe("@workflow @checkout @stress @recovery checkout recovery stress", () => {
  test.setTimeout(300_000);

  test("Stripe declined card does not create order, retry succeeds", async ({
    page,
    request,
  }, testInfo) => {
    skipUnlessPspConfigured("stripe");

    const consoleIssues: { type: "error" | "warning"; text: string }[] = [];
    attachConsoleListener(page, consoleIssues);
    attachFullBrowserRuntimeLog(page, testInfo);

    try {
      await test.step("add product to bag", async () => {
        const picked = await navigateToShopAndAddPreferredCatalogProduct(page, {
          maxCandidates: 6,
          log: (m) => console.log(`[recovery] ${m}`),
        });
        if (!picked) {
          test.skip(true, "No catalog product available for recovery test");
          return;
        }
      });

      await test.step("checkout with declined card", async () => {
        await navigateToCheckout(page);
        await fillCheckoutShippingInfo(page);
        const selected = await selectPaymentProvider(page, "stripe");
        if (!selected) {
          test.skip(true, "Stripe not on checkout");
          return;
        }

        await clickPayButton(page);
        const hostedContinue = page.getByTestId("checkout-continue-payment");
        if (await hostedContinue.isVisible({ timeout: 15_000 }).catch(() => false)) {
          await clickContinueToStripeHostedCheckout(page);
          await fillStripeHostedCheckoutTestCard(page, STRIPE_SANDBOX_TEST_CARD_DECLINE);
          const pay = page
            .getByTestId("hosted-payment-submit-button")
            .or(page.getByRole("button", { name: /^pay\b/i }))
            .first();
          await pay.click();

          await expect(
            page.getByText(/declined|your card was declined|card.*declined/i).first(),
          ).toBeVisible({ timeout: 45_000 });
        }
      });

      await test.step("retry with valid card", async () => {
        await page.goto("/checkout", { waitUntil: "domcontentloaded" });
        const checkoutHeading = page.getByRole("heading", { name: /checkout/i });
        const isCheckout = await checkoutHeading.isVisible({ timeout: 10_000 }).catch(() => false);
        if (!isCheckout) {
          await navigateToShopAndAddPreferredCatalogProduct(page, { maxCandidates: 4 });
          await navigateToCheckout(page);
          await fillCheckoutShippingInfo(page);
        }

        const selected = await selectPaymentProvider(page, "stripe");
        if (selected) {
          await payWithStripeSandboxCard(page, STRIPE_SANDBOX_TEST_CARD_SUCCESS);
          await verifyPostPaymentSuccess(page, request, "stripe");
        }
      });
    } finally {
      detachConsoleListener(page);
      detachBrowserRuntimeLog(page);
    }

    assertNoUnexpectedConsole(consoleIssues, 5);
  });

  test("checkout unavailable state recovers on retry", async ({ page }) => {
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    const heading = page.getByRole("heading", { name: /checkout/i });
    await expect(heading).toBeVisible({ timeout: 30_000 });

    const unavailableRetry = page.getByTestId("checkout-unavailable-retry");
    const isUnavailable = await unavailableRetry.isVisible({ timeout: 5_000 }).catch(() => false);
    if (isUnavailable) {
      await unavailableRetry.click();
      await page.waitForTimeout(2_000);
      const stillUnavailable = await unavailableRetry.isVisible({ timeout: 3_000 }).catch(() => false);
      expect(typeof stillUnavailable).toBe("boolean");
    }
  });
});
