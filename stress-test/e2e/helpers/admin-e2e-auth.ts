import "../runtime-logs-init";
import { expect, type Page } from "@playwright/test";

export const adminBase =
  process.env.PLAYWRIGHT_ADMIN_URL ?? "http://localhost:3001";

function firstAdminAllowedEmail(): string | undefined {
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
  if (process.env.AUTH_DISABLED === "true" || process.env.AUTH_DISABLE === "true") {
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
    process.env.E2E_ADMIN_PASSWORD?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!email || !password?.trim()) {
    return "skip_no_env";
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.goto(`${adminBase}/sign-in/e2e`, { waitUntil: "domcontentloaded" });
    const form = page.getByTestId("e2e-credentials-form");
    if ((await form.count()) === 0) return "skip_no_ui";
    await expect(form).toBeVisible({ timeout: 15_000 });
    const passwordInput = page.getByTestId("e2e-admin-password");
    await page.getByTestId("e2e-admin-email").fill(email);
    await passwordInput.fill(password);
    await expect(passwordInput).toHaveValue(password);
    await page.getByTestId("e2e-admin-submit").click();
    try {
      await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 });
      return "ok";
    } catch {
      if (attempt === 3) throw new Error("E2E admin credentials did not authenticate after four attempts");
      await page.waitForTimeout(500);
    }
  }
  throw new Error("E2E admin credentials did not authenticate");
}
