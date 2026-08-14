import { expect, type Page } from "@playwright/test";

import {
  expectCheckoutShellVisible,
  gotoFirstCatalogPdp,
} from "../helpers/storefront";
import {
  navigateToShopAndAddFirstProduct,
  selectPaymentProvider,
  fillCheckoutShippingInfo,
} from "../helpers/checkout";
import { strictCatalog } from "../fixtures/env";

export type CheckoutWorkflowResult = {
  reachedPdp: boolean;
  slug: string | null;
  paymentTogglesFound: boolean;
};

/**
 * Chained storefront path: health implied by navigation → shop → optional PDP → checkout shell.
 * Prior step output (slug) informs whether add-to-bag steps run.
 */
export async function runGuestCheckoutShellWorkflow(
  page: Page,
): Promise<CheckoutWorkflowResult> {
  const slug = await gotoFirstCatalogPdp(page);
  if (!slug) {
    if (strictCatalog()) {
      throw new Error("No catalog products for strict E2E.");
    }
    await page.goto("/checkout");
    await expectCheckoutShellVisible(page);
    return { reachedPdp: false, slug: null, paymentTogglesFound: false };
  }

  const addBtn = page.getByTestId("pdp-add-to-bag");
  await expect(addBtn).toBeVisible({ timeout: 30_000 });
  await expect(addBtn).toBeEnabled({ timeout: 45_000 });

  await page.goto("/checkout");
  await expectCheckoutShellVisible(page);

  const payStripe = page.getByTestId("payment-stripe");
  const payCod = page.getByTestId("payment-cod");
  const toggles =
    (await payStripe.count()) + (await payCod.count()) > 0 ||
    (await page.locator("[data-testid^='payment-']").count()) > 0;

  return { reachedPdp: true, slug, paymentTogglesFound: toggles };
}

/**
 * Exercise payment row selection when providers render (chained UI state).
 */
export async function exercisePaymentMethodToggles(page: Page): Promise<string[]> {
  const tried: string[] = [];
  for (const key of ["cod", "stripe", "paypal", "xendit"] as const) {
    const ok = await selectPaymentProvider(page, key);
    if (ok) tried.push(key);
  }
  return tried;
}

/**
 * Optional: fill visible shipping fields when checkout shows address controls (guest path).
 */
export async function exerciseCheckoutAddressFields(page: Page): Promise<void> {
  await fillCheckoutShippingInfo(page).catch(() => {});
}

/** Alternate entry: link navigation from shop listing (shared with PSP specs). */
export async function runShopLinkToCheckoutPath(page: Page): Promise<void> {
  await navigateToShopAndAddFirstProduct(page);
  await page.goto("/checkout");
  await expectCheckoutShellVisible(page);
}
