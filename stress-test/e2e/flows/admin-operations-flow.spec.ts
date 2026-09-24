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
        "E2E credentials UI missing. Use /sign-in/e2e with ADMIN_ALLOWED_EMAILS + AUTH_SECRET. Run pnpm e2e:ensure-staff.",
      );
    }
    if (login === "skip_no_env") {
      test.skip(
        true,
        "Set ADMIN_ALLOWED_EMAILS and AUTH_SECRET in root .env.local (Playwright loads via playwright.config).",
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

  test("CMS page creation, component editing, and cleanup are persisted", async ({ page }) => {
    test.setTimeout(120_000);
    const login = await e2eAdminLogin(page);
    if (login === "skip_no_ui" || login === "skip_no_env") test.skip(true, "Admin E2E auth is not configured.");

    await page.goto(`${adminBase}/admin/cms/builder`, { waitUntil: "domcontentloaded" });
    const fixtureTitle = `E2E CMS ${Date.now()}`;
    const fixtureSlug = `e2e-cms-${Date.now()}`;

    await page.getByRole("button", { name: "Pages", exact: true }).click();
    await page.getByRole("button", { name: "Add page" }).click();
    await page.getByLabel("Page title").fill(fixtureTitle);
    await page.getByLabel("URL slug").fill(fixtureSlug);
    await page.getByRole("button", { name: "Create page" }).click();

    try {
      await page.getByRole("button", { name: "Components", exact: true }).click();
      const addComponent = page.getByRole("button", { name: /^Add / }).first();
      await expect(addComponent).toBeVisible();
      await page.getByRole("tab", { name: "Blocks", exact: true }).click();
      const addBlock = page.locator("button").filter({ hasText: /Hero banner|Heading|Paragraph|Text/ }).last();
      await expect(addBlock).toBeVisible();
      await addBlock.click();

      const createResponse = page.waitForResponse(
        (response) => response.url().includes("/api/admin/cms/pages") && [200, 201].includes(response.status()),
      );
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await createResponse;

      await expect(page.getByText("Hero banner", { exact: true }).last()).toBeVisible();
      const headline = page.getByLabel("Headline");
      await expect(headline).toBeVisible();
      await headline.fill("E2E verified hero");
      await headline.blur();
      await expect(headline).toHaveValue("E2E verified hero");
      await page.waitForTimeout(250);
      const updateResponse = page.waitForResponse(
        (response) => response.url().includes("/api/admin/cms/pages/") && response.request().method() === "PUT" && response.status() === 200,
      );
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await updateResponse;
      const undo = page.getByRole("button", { name: "Undo" });
      const redo = page.getByRole("button", { name: "Redo" });
      await expect(undo).toBeEnabled();
      await undo.click();
      await expect(redo).toBeEnabled();
      await redo.click();

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Pages", exact: true }).click();
      await page.getByRole("button", { name: fixtureTitle, exact: true }).click();
      await expect(page.getByText("Hero banner", { exact: true }).last()).toBeVisible();
      await page.getByText("Hero banner", { exact: true }).last().click();
      await expect(page.getByLabel("Headline")).toHaveValue("E2E verified hero");
      await expect(page.locator("body")).not.toContainText(/Maximum update depth|Application error|Unhandled Runtime Error/i);
    } finally {
      await page.getByRole("button", { name: "Pages", exact: true }).click().catch(() => undefined);
      const deleteButtons = page.getByRole("button", { name: /^Delete E2E CMS / });
      for (let index = await deleteButtons.count() - 1; index >= 0; index -= 1) {
        page.once("dialog", (dialog) => dialog.accept());
        await deleteButtons.nth(index).click();
      }
    }
  });
});
