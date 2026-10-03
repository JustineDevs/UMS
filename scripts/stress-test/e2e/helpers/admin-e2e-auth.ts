import "../runtime-logs-init";
import { expect, type Page } from "@playwright/test";

export const adminBase =
  process.env.PLAYWRIGHT_WEB_URL ??
  process.env.PLAYWRIGHT_BASE_URL ??
  "http://127.0.0.1:3000";

function firstAdminAllowedEmail(): string | undefined {
  const raw = process.env.ADMIN_ALLOWED_EMAILS?.trim();
  if (!raw) return undefined;
  const first = raw.split(",")[0]?.trim().toLowerCase();
  return first || undefined;
}

export type E2eAdminLoginResult = "ok" | "skip_no_ui" | "skip_no_env";

/**
 * The storefront intentionally gates account, wishlist, and checkout routes
 * until a delivery profile exists. Keep authenticated browser proofs focused
 * on their target behavior by completing that one-time local fixture setup.
 */
export async function ensureE2eProfileComplete(page: Page, nextPath = "/account/profile"): Promise<void> {
  const status = await page.evaluate(async () => {
    const response = await fetch("/api/account/profile/status", { cache: "no-store" });
    return { status: response.status, body: (await response.json().catch(() => null)) as { complete?: boolean } | null };
  });
  if (status.status !== 200 || status.body?.complete === true) return;

  await page.goto(`/onboarding?next=${encodeURIComponent(nextPath)}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.locator('input[name="name"]').fill("Justine Devs (Official)");
  await page.locator('input[name="tel"]').fill("09637628097");
  await expect(page.locator('input[name="name"]')).toHaveValue("Justine Devs (Official)");
  await expect(page.locator('input[name="tel"]')).toHaveValue("09637628097");
  await page.locator("#shipping-line1").fill("123 Test Street");
  await page.locator("#shipping-region").selectOption({ index: 1 });
  await expect(page.locator("#shipping-province option")).not.toHaveCount(1, { timeout: 10_000 });
  // NCR is represented by a synthetic option because it has no province rows
  // in the PSGC dataset; select its stable value rather than a timing-sensitive
  // option index.
  await expect(page.locator('#shipping-province option[value="__ncr__"]')).toHaveCount(1, { timeout: 10_000 });
  await page.locator("#shipping-province").selectOption({ value: "__ncr__" });
  await expect(page.locator("#shipping-province")).not.toHaveValue("");
  await expect(page.locator("#shipping-city option")).not.toHaveCount(1, { timeout: 10_000 });
  await page.locator("#shipping-city").selectOption({ index: 1 });
  await expect(page.locator("#shipping-barangay option")).not.toHaveCount(1, { timeout: 10_000 });
  await page.locator("#shipping-barangay").selectOption({ index: 1 });
  await page.getByTestId("checkout-onboarding-continue").click();
  await expect.poll(async () => {
    const response = await page.request.get("/api/account/profile/status", { failOnStatusCode: false });
    const body = (await response.json().catch(() => null)) as { complete?: boolean } | null;
    return response.status() === 200 && body?.complete === true;
  }, { timeout: 30_000 }).toBe(true);
}

/**
 * Signs in via `/sign-in/e2e` using the first `ADMIN_ALLOWED_EMAILS` entry and `AUTH_SECRET`.
 * Requires `E2E_ADMIN_AUTH=1` and `pnpm e2e:ensure-staff` (user +
 * `staff_permission_grants` `*` for full route coverage). Explicit opt-in keeps
 * ordinary local smoke runs from contacting a remote Supabase project.
 */
export async function e2eAdminLogin(page: Page): Promise<E2eAdminLoginResult> {
  if (process.env.E2E_ADMIN_AUTH !== "1") return "skip_no_env";
  if (
    process.env.AUTH_DISABLED === "true" ||
    process.env.AUTH_DISABLE === "true"
  ) {
    try {
      await page.goto(`${adminBase}/admin`, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/admin/, { timeout: 45_000 });
    } catch {
      return "skip_no_ui";
    }
    return "ok";
  }
  const email = firstAdminAllowedEmail();
  const password =
    process.env.E2E_ADMIN_PASSWORD?.trim() || process.env.AUTH_SECRET?.trim();
  if (!email || !password?.trim()) {
    return "skip_no_env";
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await page.goto(`${adminBase}/sign-in/e2e`, {
      waitUntil: "domcontentloaded",
    });
    if (/\/admin(?:[/?#]|$)/i.test(page.url())) return "ok";
    const form = page.getByTestId("e2e-credentials-form");
    if (response?.status() === 404) {
      if (attempt < 3) {
        await page.waitForTimeout(750 * (attempt + 1));
        continue;
      }
      return "skip_no_ui";
    }
    try {
      await form.waitFor({ state: "visible", timeout: 15_000 });
    } catch {
      if (attempt < 3) {
        await page.waitForTimeout(750 * (attempt + 1));
        continue;
      }
      return "skip_no_ui";
    }
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => undefined);
    const passwordInput = page.getByTestId("e2e-admin-password");
    await page.getByTestId("e2e-admin-email").fill(email);
    await passwordInput.fill(password);
    await expect(passwordInput).toHaveValue(password);
    await page.getByTestId("e2e-admin-submit").click();
    try {
      await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 });
      return "ok";
    } catch {
      if (attempt === 3)
        throw new Error(
          "E2E admin credentials did not authenticate after four attempts",
        );
      await page.waitForTimeout(500);
    }
  }
  throw new Error("E2E admin credentials did not authenticate");
}
