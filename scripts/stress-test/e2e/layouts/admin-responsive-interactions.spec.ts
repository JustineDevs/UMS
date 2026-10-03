import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "../fixtures/admin-auth";

async function gotoWithRetry(page: Parameters<typeof signInAsAdmin>[0], route: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(route, { waitUntil: "commit", timeout: 120_000 });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await page.waitForTimeout(attempt * 1_000);
    }
  }
  throw lastError;
}

test.describe("admin responsive interactions", () => {
  test("mobile navigation opens, closes, and stays within the viewport", async ({ page }) => {
    const auth = await signInAsAdmin(page);
    test.skip(auth !== "ok", `Admin authentication unavailable: ${auth}`);

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoWithRetry(page, "/admin");

    const menuButton = page.getByRole("button", { name: "Open navigation menu" });
    await expect(menuButton).toBeVisible({ timeout: 120_000 });
    await menuButton.click();

    const sidebar = page.locator("#admin-sidebar-nav");
    await expect(sidebar).toBeVisible();
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 390);

    await page.keyboard.press("Escape");
    await expect(sidebar).toHaveClass(/-translate-x-full/);
  });

  test("narrow laptop header uses visible icon controls", async ({ page }) => {
    const auth = await signInAsAdmin(page);
    test.skip(auth !== "ok", `Admin authentication unavailable: ${auth}`);

    await page.setViewportSize({ width: 980, height: 926 });
    await gotoWithRetry(page, "/admin");

    const menu = page.getByRole("button", { name: "Open navigation menu" });
    const search = page.getByRole("button", { name: "Open search" });
    await expect(menu).toBeVisible({ timeout: 120_000 });
    await expect(search).toBeVisible({ timeout: 120_000 });
    await expect(menu.locator("svg")).toBeVisible();
    await expect(search.locator("svg")).toBeVisible();
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 980);
  });

  test("loyalty enrollment dialog is usable at phone width", async ({ page }) => {
    const auth = await signInAsAdmin(page);
    test.skip(auth !== "ok", `Admin authentication unavailable: ${auth}`);

    await page.setViewportSize({ width: 320, height: 568 });
    await gotoWithRetry(page, "/admin/loyalty");
    await page.getByRole("button", { name: "Enroll Customer" }).click();

    await expect(page.getByRole("heading", { name: "Enroll Customer" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Search customers to enroll" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Sort customers to enroll" })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Customers available for enrollment" })).toBeVisible();
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 320);

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Enroll Customer" })).toBeHidden();
  });

  test("product preview expands and closes without phone overflow", async ({ page }) => {
    const auth = await signInAsAdmin(page);
    test.skip(auth !== "ok", `Admin authentication unavailable: ${auth}`);

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoWithRetry(page, "/admin/catalog/new");
    await page.getByRole("button", { name: "Preview" }).click();

    const preview = page.getByRole("dialog", { name: "Storefront catalog preview" });
    await expect(preview).toBeVisible();
    await expect(page.getByRole("button", { name: "Close full-screen preview" })).toBeVisible();
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 390);

    await page.getByRole("button", { name: "Close full-screen preview" }).click();
    await expect(preview).toBeHidden();
  });

  test("order row actions do not collide with the order toolbar", async ({ page }) => {
    const auth = await signInAsAdmin(page);
    test.skip(auth !== "ok", `Admin authentication unavailable: ${auth}`);

    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoWithRetry(page, "/admin/orders");

    const action = page.getByRole("button", { name: /Actions for order/ }).first();
    await expect(action).toBeVisible({ timeout: 120_000 });
    await action.click();

    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    const menuBox = await menu.boundingBox();
    expect(menuBox).not.toBeNull();
    expect(await menu.getAttribute("data-side")).toBe("top");
  });

  test("campaign dialog remains contained and closable at phone width", async ({ page }) => {
    const auth = await signInAsAdmin(page);
    test.skip(auth !== "ok", `Admin authentication unavailable: ${auth}`);

    await page.setViewportSize({ width: 320, height: 568 });
    await gotoWithRetry(page, "/admin/campaigns");
    const newCampaign = page.getByRole("button", { name: /New campaign/i }).first();
    await expect(newCampaign).toBeVisible({ timeout: 120_000 });
    await expect(newCampaign).toBeEnabled({ timeout: 120_000 });
    await page.waitForTimeout(250);
    await newCampaign.click();

    const dialog = page.getByRole("dialog", { name: "Create Campaign" });
    await expect(dialog).toBeVisible({ timeout: 120_000 });
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    if (!dialogBox) return;
    expect(dialogBox.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox.y).toBeGreaterThanOrEqual(0);
    expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(320);
    expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(568);
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 320);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("users dialog remains accessible and closable at phone width", async ({ page }) => {
    const auth = await signInAsAdmin(page);
    test.skip(auth !== "ok", `Admin authentication unavailable: ${auth}`);

    await page.setViewportSize({ width: 320, height: 568 });
    await gotoWithRetry(page, "/admin/users");
    const addUser = page.getByRole("button", { name: "Add User" });
    await expect(addUser).toBeVisible({ timeout: 120_000 });
    await expect(addUser).toBeEnabled({ timeout: 120_000 });
    await page.waitForTimeout(250);
    await addUser.click();

    const dialog = page.getByRole("dialog", { name: "Add User" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Full Name")).toBeVisible();
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    if (!dialogBox) return;
    expect(dialogBox.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(320);
    expect(await page.locator("html")).toHaveJSProperty("scrollWidth", 320);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
