import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
