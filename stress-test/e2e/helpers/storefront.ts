import "../runtime-logs-init";
import { expect, type Page } from "@playwright/test";

/**
 * Checkout is auth-gated: guests see a Checkout heading and sign-in CTA; signed-in users with a
 * complete profile see pay controls (`checkout-submit-pay`).
 */
export async function expectCheckoutShellVisible(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: /^Checkout$/i })).toBeVisible({
    timeout: 30_000,
  });
  const pay = page.getByTestId("checkout-submit-pay");
  const guest = page.getByTestId("checkout-guest-sign-in");
  const onboard = page.getByTestId("checkout-onboarding-continue");
  const retry = page.getByTestId("checkout-profile-retry");
  await expect(pay.or(guest).or(onboard).or(retry)).toBeVisible({
    timeout: 20_000,
  });
}

/**
 * Opens /shop and navigates to the first product PDP using CatalogProductCard
 * `data-product-slug`. Returns the slug when the PDP responds with a success status.
 */
export async function gotoFirstCatalogPdp(page: Page): Promise<string | null> {
  await page.goto("/shop", { waitUntil: "load" });
  const first = page.locator("[data-product-slug]").first();
  try {
    await first.waitFor({ state: "visible", timeout: 90_000 });
  } catch {
    return null;
  }
  const slug = await first.getAttribute("data-product-slug");
  const trimmed = slug?.trim();
  if (!trimmed) return null;
  const res = await page.goto(`/shop/${trimmed}`, { waitUntil: "domcontentloaded" });
  if (!res) return null;
  if (res.status() >= 400) return null;
  return trimmed;
}
