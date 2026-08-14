import { test, expect } from "@playwright/test";
import { adminBase, e2eAdminLogin } from "../helpers/admin-e2e-auth";

/**
 * One authenticated pass through primary admin surfaces (runs once per full stress / E2E run).
 * Order matches common ops: dashboard, commerce, POS, content, settings, platform.
 */
const ADMIN_OPERATION_PATHS: readonly string[] = [
  "/admin",
  "/admin/orders",
  "/admin/inventory",
  "/admin/catalog",
  "/admin/pos",
  "/admin/cms",
  "/admin/settings/payments",
  "/admin/workflow",
  "/admin/devices",
  "/admin/reviews",
  "/admin/loyalty",
  "/admin/users",
  "/admin/campaigns",
  "/admin/analytics",
  "/admin/crm",
  "/admin/channels",
  "/admin/offline-queue",
  "/admin/receipts",
  "/admin/audit",
  "/admin/chat-orders",
  "/admin/settings/integrations",
  "/admin/settings/preferences",
  "/admin/cms/builder",
  "/admin/finance/reconciliation",
];

test.describe.configure({ mode: "serial" });

test.describe("@admin Admin operations E2E", () => {
  test("authenticated stress pass over core routes", async ({ page }) => {
    /** Serial pass over many routes; dev cold compile can exceed default 180s. */
    test.setTimeout(300_000);
    const login = await e2eAdminLogin(page);
    if (login === "skip_no_ui") {
      test.skip(
        true,
        "E2E credentials UI missing. Use /sign-in/e2e with ADMIN_ALLOWED_EMAILS + NEXTAUTH_SECRET. Run pnpm e2e:ensure-staff.",
      );
    }
    if (login === "skip_no_env") {
      test.skip(
        true,
        "Set ADMIN_ALLOWED_EMAILS and NEXTAUTH_SECRET in root .env.local (Playwright loads via playwright.config).",
      );
    }

    for (const path of ADMIN_OPERATION_PATHS) {
      await test.step(path, async () => {
        await page.goto(`${adminBase}${path}`, {
          waitUntil: "domcontentloaded",
          timeout: 120_000,
        });

        await expect(page).not.toHaveURL(/\/sign-in(\/|$|\?)|\/api\/auth\/signin/i, {
          timeout: 15_000,
        });

        const bodyText = await page.locator("body").innerText();
        expect(bodyText).not.toMatch(/Application error|Unhandled Runtime Error/i);

        const pathname = new URL(page.url()).pathname.replace(/\/$/, "") || "/";
        const target = path.replace(/\/$/, "") || "/";
        const onPath = pathname === target || pathname.startsWith(`${target}/`);
        expect(onPath, `Expected to load ${path}; got ${page.url()} (run pnpm e2e:ensure-staff for * grants).`).toBeTruthy();
      });
    }
  });

  test("CMS nested DOM edits are persisted to history", async ({ page }) => {
    test.setTimeout(120_000);
    const login = await e2eAdminLogin(page);
    if (login === "skip_no_ui" || login === "skip_no_env") test.skip(true, "Admin E2E auth is not configured.");

    await page.goto(`${adminBase}/admin/cms/builder`, { waitUntil: "domcontentloaded" });
    const canvas = page.locator('iframe[title="Storefront canvas"]').contentFrame();
    const nested = canvas.locator('[data-cms-id^="cms-dom-"][data-cms-block-id]').first();
    await expect(nested).toBeVisible({ timeout: 30_000 });
    await nested.click({ force: true });

    const padding = page.locator("label").filter({ hasText: "padding" }).last().locator("input");
    await expect(padding).toBeVisible();
    await padding.fill("24px");
    await padding.blur();
    const undo = page.getByRole("button", { name: "Undo" });
    const redo = page.getByRole("button", { name: "Redo" });
    await expect(undo).toBeEnabled();
    await undo.click();
    await expect(redo).toBeEnabled();
    await redo.click();
    await expect(page.locator("body")).not.toContainText(/Maximum update depth|Application error|Unhandled Runtime Error/i);
  });
});
