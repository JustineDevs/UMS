import "../runtime-logs-init";
import { expect, type Page } from "@playwright/test";

/**
 * Checkout is auth-gated: guests see a Checkout heading and sign-in CTA; signed-in users may
 * first see profile onboarding before pay controls (`checkout-submit-pay`).
 */
export async function expectCheckoutShellVisible(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", { name: /^(Checkout|Welcome)$/i }),
  ).toBeVisible({ timeout: 30_000 });
  const pay = page.getByTestId("checkout-submit-pay");
  const guest = page.getByTestId("checkout-guest-sign-in");
  const onboard = page.getByTestId("checkout-onboarding-continue");
  const retry = page.getByTestId("checkout-profile-retry");
  const signIn = page.getByRole("heading", { name: "Sign in", exact: true });
  const welcomeBack = page.getByRole("heading", { name: "Welcome back", exact: true });
  const googleSignIn = page.getByRole("button", { name: "Continue with Google", exact: true });
  const onboardingGuard = page.getByRole("button", { name: "Continue", exact: true });
  await expect(
    pay
      .or(guest)
      .or(onboard)
      .or(retry)
      .or(signIn)
      .or(welcomeBack)
      .or(googleSignIn)
      .or(onboardingGuard)
      .first(),
  ).toBeVisible({ timeout: 20_000 });
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
  let navigationSucceeded = true;
  let res;
  try {
    res = await page.goto(`/shop/${trimmed}`, { waitUntil: "domcontentloaded" });
  } catch (error) {
    // Next dev can abort a navigation while compiling the PDP. Confirm the
    // resulting document before treating that transient browser error as a
    // missing product.
    if (!(error instanceof Error) || !error.message.includes("ERR_ABORTED")) throw error;
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    await page.locator("main").waitFor({ state: "visible", timeout: 30_000 });
    navigationSucceeded = false;
    res = null;
  }
  if (navigationSucceeded && (!res || res.status() >= 400)) return null;
  return trimmed;
}
