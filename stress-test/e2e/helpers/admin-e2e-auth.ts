import "../runtime-logs-init";
import { expect, type Page } from "@playwright/test";

export const adminBase =
  process.env.PLAYWRIGHT_ADMIN_URL ?? "http://localhost:3001";

export function firstAdminAllowedEmail(): string | undefined {
  const raw = process.env.ADMIN_ALLOWED_EMAILS?.trim();
  if (!raw) return undefined;
  const first = raw.split(",")[0]?.trim().toLowerCase();
  return first || undefined;
}

export type E2eAdminLoginResult = "ok" | "skip_no_ui" | "skip_no_env";

/**
 * Signs in via `/sign-in/e2e` using the first `ADMIN_ALLOWED_EMAILS` entry and `NEXTAUTH_SECRET`.
 * Requires `pnpm e2e:ensure-staff` (user + `staff_permission_grants` `*` for full route coverage).
 */
export async function e2eAdminLogin(page: Page): Promise<E2eAdminLoginResult> {
  const email = firstAdminAllowedEmail();
  const password = process.env.NEXTAUTH_SECRET;
  await page.goto(`${adminBase}/sign-in/e2e`, { waitUntil: "domcontentloaded" });
  const form = page.getByTestId("e2e-credentials-form");
  if ((await form.count()) === 0) {
    return "skip_no_ui";
  }
  if (!email || !password?.trim()) {
    return "skip_no_env";
  }

  await expect(form).toBeVisible({ timeout: 15_000 });

  await page.getByTestId("e2e-admin-email").fill(email);
  await page.getByTestId("e2e-admin-password").fill(password);
  await page.getByTestId("e2e-admin-submit").click();

  await expect(page).toHaveURL(/\/admin/, { timeout: 45_000 });
  return "ok";
}
