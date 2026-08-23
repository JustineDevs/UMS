import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setViewport } from "../helpers/viewports";

const routes = [
  "/shop",
  "/collections",
  "/cart",
  "/checkout?guest=1",
  "/privacy",
  "/terms",
  "/cookies",
  "/accessibility",
];

for (const route of routes) {
  test(`axe: ${route}`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    // Checkout keeps polling commerce state; networkidle is not a stable readiness signal.
    await expect(page.locator("#main-content main").first()).toBeVisible({
      timeout: 15_000,
    });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations,
      JSON.stringify(results.violations, null, 2),
    ).toEqual([]);
  });
}

test("axe: /account auth-disabled local mode", async ({ page }) => {
  await page.goto("/account", { waitUntil: "domcontentloaded" });
  await expect(
    page
      .getByRole("heading", { name: /welcome|your account, in one place/i })
      .first(),
  ).toBeVisible({ timeout: 15_000 });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations,
    JSON.stringify(results.violations, null, 2),
  ).toEqual([]);
});

test("axe: mobile shop filter dialog", async ({ page }) => {
  await setViewport(page, "mobile");
  await page.goto("/shop", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Filters" }).click();
  const dialog = page.getByRole("dialog", { name: "Shop filters" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  const results = await new AxeBuilder({ page })
    .include("#shop-filter-panel")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations,
    JSON.stringify(results.violations, null, 2),
  ).toEqual([]);
});
