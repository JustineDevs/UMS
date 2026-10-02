/**
 * Admin authentication fixture for e2e tests.
 *
 * Uses the /sign-in/e2e shortcut route which is only active when NODE_ENV=development.
 * Credentials come from ADMIN_ALLOWED_EMAILS (first entry) and AUTH_SECRET.
 * The fixture is opt-in via E2E_ADMIN_AUTH=1 so routine local runs stay offline.
 * Run `pnpm e2e:ensure-staff` to upsert the Supabase user before running these tests.
 */
import type { Page } from "@playwright/test";

const adminBase = process.env.PLAYWRIGHT_WEB_URL ?? "http://127.0.0.1:3000";
const storefrontBase = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

function getAdminEmail(): string | undefined {
  const raw = process.env.ADMIN_ALLOWED_EMAILS?.trim();
  if (!raw) return undefined;
  return raw.split(",")[0]?.trim().toLowerCase() || undefined;
}

function getAdminPassword(): string | undefined {
  return process.env.AUTH_SECRET?.trim() || undefined;
}

export type SignInResult = "ok" | "skip_no_env" | "skip_no_ui";

/**
 * Signs into the unified web app's admin surface at /sign-in/e2e.
 * Returns "ok" on success, "skip_no_env" when credentials are missing,
 * or "skip_no_ui" when the e2e route is not accessible.
 */
export async function signInAsAdmin(
  page: Page,
  origin = adminBase,
): Promise<SignInResult> {
  if (process.env.AUTH_DISABLED === "true") {
    try {
      await page.goto(`${origin}/admin`, { timeout: 45_000 });
      return /\/admin(?:[/?#]|$)/i.test(page.url()) ? "ok" : "skip_no_ui";
    } catch {
      return "skip_no_ui";
    }
  }
  const email = getAdminEmail();
  const password = getAdminPassword();

  if (!email || !password) {
    return "skip_no_env";
  }

  try {
    await page.goto(`${origin}/sign-in/e2e`, { timeout: 15_000 });
  } catch {
    return "skip_no_ui";
  }

  if (/\/admin(?:[/?#]|$)/i.test(page.url())) {
    return "ok";
  }

  const form = page.getByTestId("e2e-credentials-form");
  const emailInput = form.getByTestId("e2e-admin-email");
  const passwordInput = form.getByTestId("e2e-admin-password");
  const submitBtn = form.getByTestId("e2e-admin-submit");

  // The first local Next compile can take longer than five seconds. Treating
  // that cold-start window as "no UI" makes the checkout proof report a
  // false authentication blocker before the form has rendered.
  const uiAvailable = await form.isVisible({ timeout: 30_000 }).catch(() => false);
  if (!uiAvailable) {
    if (/\/admin(?:[/?#]|$)/i.test(page.url())) {
      return "ok";
    }
    return "skip_no_ui";
  }

  await emailInput.fill(email);
  await passwordInput.fill(password);
  await submitBtn.click();

  try {
    await Promise.race([
      page.waitForURL(/\/admin/, { timeout: 30_000 }),
      form.getByRole("alert").waitFor({ state: "visible", timeout: 30_000 }),
    ]);
  } catch {
    return "skip_no_ui";
  }

  if (!/\/admin(?:[/?#]|$)/i.test(page.url())) {
    const message = await form.getByRole("alert").textContent().catch(() => null);
    throw new Error(
      message?.trim() ||
        "E2E staff sign-in did not establish an admin session within 30 seconds.",
    );
  }

  return "ok";
}

/**
 * Signs into the unified web app's admin surface and returns session cookies for API requests.
 */
async function signInAsAdminAndGetCookies(
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
