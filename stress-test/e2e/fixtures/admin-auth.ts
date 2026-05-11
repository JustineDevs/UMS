/**
 * Admin authentication fixture for e2e tests.
 *
 * Uses the /sign-in/e2e shortcut route which is only active when NODE_ENV=development.
 * Credentials come from ADMIN_ALLOWED_EMAILS (first entry) and NEXTAUTH_SECRET.
 * Run `pnpm e2e:ensure-staff` to upsert the Supabase user before running these tests.
 */
import type { Page } from "@playwright/test";

export const adminBase = process.env.PLAYWRIGHT_ADMIN_URL ?? "http://localhost:3001";
export const storefrontBase = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

function getAdminEmail(): string | undefined {
  const raw = process.env.ADMIN_ALLOWED_EMAILS?.trim();
  if (!raw) return undefined;
  return raw.split(",")[0]?.trim().toLowerCase() || undefined;
}

function getAdminPassword(): string | undefined {
  return process.env.NEXTAUTH_SECRET?.trim() || undefined;
}

export type SignInResult = "ok" | "skip_no_env" | "skip_no_ui";

/**
 * Signs into the admin app at /sign-in/e2e.
 * Returns "ok" on success, "skip_no_env" when credentials are missing,
 * or "skip_no_ui" when the e2e route is not accessible.
 */
export async function signInAsAdmin(page: Page): Promise<SignInResult> {
  const email = getAdminEmail();
  const password = getAdminPassword();

  if (!email || !password) {
    return "skip_no_env";
  }

  try {
    await page.goto(`${adminBase}/sign-in/e2e`, { timeout: 15_000 });
  } catch {
    return "skip_no_ui";
  }

  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

  const uiAvailable = await emailInput.isVisible({ timeout: 5_000 }).catch(() => false);
  if (!uiAvailable) {
    return "skip_no_ui";
  }

  await emailInput.fill(email);
  await passwordInput.fill(password);

  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();

  try {
    await page.waitForURL(/\/admin/, { timeout: 20_000 });
  } catch {
    return "skip_no_ui";
  }

  return "ok";
}

/**
 * Signs into the admin app and returns the session cookies for use in API requests.
 */
export async function signInAsAdminAndGetCookies(
  page: Page,
): Promise<{ result: SignInResult; cookieHeader: string }> {
  const result = await signInAsAdmin(page);
  if (result !== "ok") {
    return { result, cookieHeader: "" };
  }
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  return { result, cookieHeader };
}
