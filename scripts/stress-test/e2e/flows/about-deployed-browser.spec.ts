import { expect, test } from "@playwright/test";

test.describe("Deployed About browser proof", () => {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    test(`${viewport.name} content, navigation, keyboard, and console`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const consoleErrors: string[] = [];
      const failedRequests: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") {
          const location = message.location().url;
          consoleErrors.push(location ? `${message.text()} (${location})` : message.text());
        }
      });
      page.on("requestfailed", (request) => {
        const url = request.url();
        // Next.js may abort speculative RSC prefetches after the route is ready.
        if (!url.includes("?_rsc=") && request.failure()?.errorText !== "net::ERR_ABORTED") {
          failedRequests.push(`${request.method()} ${url}`);
        }
      });

      await page.goto("/about", { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { name: /gear for the work/i })).toBeVisible();
      await expect(page).toHaveTitle(/about/i);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /promise to working musicians/i);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/about$/);
      const organization = await page.locator('script[type="application/ld+json"]').evaluateAll((nodes) =>
        nodes.map((node) => {
          try {
            return JSON.parse(node.textContent ?? "{}");
          } catch {
            return null;
          }
        }).find((value) => value?.["@type"] === "Organization"),
      );
      expect(organization).toMatchObject({ "@context": "https://schema.org", "@type": "Organization", name: "Universal Music Store" });
      if (viewport.name === "mobile") {
        await page.getByTestId("mobile-menu-trigger").click();
        await expect(page.getByRole("link", { name: "Browse the shop", exact: true })).toHaveAttribute("href", "/shop");
      } else {
        await expect(page.getByRole("link", { name: "Browse the shop", exact: true })).toHaveAttribute("href", "/shop");
      }

      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewport + 1);

      const navLinks = page.locator("header a:visible");
      const navCount = await navLinks.count();
      expect(navCount).toBeGreaterThan(0);
      for (let index = 0; index < navCount; index += 1) {
        await navLinks.nth(index).focus();
        await expect(navLinks.nth(index)).toBeFocused();
      }

      expect(consoleErrors, `console errors on ${viewport.name}`).toEqual([]);
      expect(failedRequests, `failed requests on ${viewport.name}`).toEqual([]);
    });
  }
});
