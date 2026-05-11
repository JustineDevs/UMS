import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";

import { expectCheckoutShellVisible, gotoFirstCatalogPdp } from "../helpers/storefront";

export async function assertStorefrontHealth(request: APIRequestContext): Promise<void> {
  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();
}

export async function journeyHomeToShop(page: Page): Promise<void> {
  const res = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(res?.ok()).toBeTruthy();
  await page.goto("/shop", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 60_000 });
}

export async function journeyStripeReturnNo5xx(page: Page): Promise<void> {
  const res = await page.goto("/checkout/stripe-return", { waitUntil: "domcontentloaded" });
  expect(res?.status() ?? 0).toBeLessThan(500);
}

export async function journeyHelpShell(page: Page): Promise<void> {
  const res = await page.goto("/help", { waitUntil: "domcontentloaded" });
  expect(res?.status() ?? 0).toBeLessThan(500);
}

export async function journeySignInHeading(page: Page): Promise<void> {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: /sign/i })).toBeVisible({
    timeout: 20_000,
  });
}

export async function journeyTrackInvalidToken(page: Page): Promise<void> {
  const res = await page.goto("/track/___invalid_token_e2e___", {
    waitUntil: "domcontentloaded",
  });
  expect(res?.status() ?? 0).toBeLessThan(500);
}

export async function journeyConcurrentCheckoutTabs(browser: Browser): Promise<void> {
  const a = await browser.newPage();
  const b = await browser.newPage();
  try {
    await a.goto("/checkout");
    await b.goto("/checkout");
    await expectCheckoutShellVisible(a);
    await expectCheckoutShellVisible(b);
  } finally {
    await a.close();
    await b.close();
  }
}

export async function journeyPdpHeadingWhenCatalogExists(page: Page): Promise<void> {
  const slug = await gotoFirstCatalogPdp(page);
  if (!slug) return;
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
    timeout: 30_000,
  });
}
