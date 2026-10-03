import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "../fixtures/admin-auth";
import { VIEWPORTS } from "../helpers/viewports";

const ADMIN_ROUTES = [
  "/admin",
  "/admin/analytics",
  "/admin/api-reference",
  "/admin/audit",
  "/admin/build",
  "/admin/campaigns",
  "/admin/catalog",
  "/admin/catalog/media",
  "/admin/catalog/new",
  "/admin/catalog/6353f464-6f5c-4452-95a3-0217ea38af2d",
  "/admin/channels",
  "/admin/chat-orders",
  "/admin/cms",
  "/admin/cms/builder",
  "/admin/commerce-metrics",
  "/admin/crm",
  "/admin/crm/test-customer",
  "/admin/delivery-logistics",
  "/admin/devices",
  "/admin/docs",
  "/admin/employees",
  "/admin/finance/reconciliation",
  "/admin/inventory",
  "/admin/invoice",
  "/admin/loyalty",
  "/admin/offline-queue",
  "/admin/orders",
  "/admin/orders/78",
  "/admin/payments",
  "/admin/pos",
  "/admin/receipts",
  "/admin/reviews",
  "/admin/roles",
  "/admin/settings/integrations",
  "/admin/settings/payments",
  "/admin/settings/preferences",
  "/admin/settings/runtime",
  "/admin/settings/storefront",
  "/admin/users",
  "/admin/workflow",
] as const;

const VIEWPORT_CASES = Object.entries(VIEWPORTS) as Array<[
  keyof typeof VIEWPORTS,
  (typeof VIEWPORTS)[keyof typeof VIEWPORTS],
]>;

test.describe("admin responsive route matrix", () => {
  test.describe.configure({ mode: "serial" });

  for (const route of ADMIN_ROUTES) {
    test(`${route} stays within the viewport at every supported dimension`, async ({ page }) => {
      const auth = await signInAsAdmin(page);
      test.skip(auth !== "ok", `Admin authentication unavailable: ${auth}`);

      for (const [viewportName, viewport] of VIEWPORT_CASES) {
        await page.setViewportSize(viewport);
        let navigationError: unknown = null;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            await page.goto(route, { waitUntil: "commit", timeout: 120_000 });
            navigationError = null;
            break;
          } catch (error: unknown) {
            navigationError = error;
            if (attempt < 3) await page.waitForTimeout(attempt * 1_000);
          }
        }
        if (navigationError) throw navigationError;
        let bodyVisible = false;
        for (let attempt = 1; attempt <= 3 && !bodyVisible; attempt += 1) {
          try {
            await page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
            bodyVisible = true;
          } catch (error) {
            if (attempt === 3) throw error;
            await page.waitForTimeout(attempt * 1_000);
            await page.goto(route, { waitUntil: "commit", timeout: 120_000 });
          }
        }
        if (!bodyVisible) throw new Error(`${route} did not produce a visible document body`);
        await page.waitForFunction(
          () => {
            const styles = getComputedStyle(document.documentElement);
            return (
              styles.getPropertyValue("--responsive-viewport-min").trim() === "0px" &&
              styles.getPropertyValue("--responsive-viewport-max").trim() === "100vw"
            );
          },
          undefined,
          { timeout: 45_000 },
        );
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            await page.evaluate(async () => {
              await Promise.race([
                document.fonts?.ready,
                new Promise((resolve) => window.setTimeout(resolve, 1500)),
              ]);
              await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            });
            break;
          } catch (error) {
            if (attempt === 3) throw error;
            await page.waitForLoadState("domcontentloaded").catch(() => undefined);
            await page.locator("body").waitFor({ state: "visible" });
          }
        }

        let metrics: {
          clientWidth: number;
          scrollWidth: number;
          clientHeight: number;
          scrollHeight: number;
          horizontalOverflow: number;
          overflowElements: string[];
          responsiveContract: { min: string; max: string };
        } | null = null;
        for (let attempt = 1; attempt <= 5 && !metrics; attempt += 1) {
          try {
            metrics = await page.evaluate(() => ({
              responsiveContract: {
                min: getComputedStyle(document.documentElement).getPropertyValue("--responsive-viewport-min").trim(),
                max: getComputedStyle(document.documentElement).getPropertyValue("--responsive-viewport-max").trim(),
              },
              clientWidth: document.documentElement.clientWidth,
              scrollWidth: document.documentElement.scrollWidth,
              clientHeight: document.documentElement.clientHeight,
              scrollHeight: document.documentElement.scrollHeight,
              horizontalOverflow: (() => {
            const html = document.documentElement;
            const body = document.body;
            const shell = document.querySelector<HTMLElement>("[data-admin-shell]");
            const content = document.querySelector<HTMLElement>("[data-admin-content]");
            const elements = [html, body, shell, content];
            const previous = elements.map((element) => element?.style.overflowX ?? "");
            elements.forEach((element) => {
              if (element) element.style.overflowX = "visible";
            });
            const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
            elements.forEach((element, index) => {
              if (element) element.style.overflowX = previous[index] ?? "";
            });
                return overflow;
              })(),
              overflowElements: Array.from(document.querySelectorAll<HTMLElement>("body *"))
                .map((element) => ({ element, rect: element.getBoundingClientRect() }))
                .filter(({ rect }) => rect.right > document.documentElement.clientWidth + 1)
                .slice(0, 8)
                .map(({ element, rect }) => `${element.tagName}.${String(element.className).slice(0, 80)} [${Math.round(rect.left)},${Math.round(rect.right)}]`),
            }));
            if (
              metrics.responsiveContract.min !== "0px" ||
              metrics.responsiveContract.max !== "100vw"
            ) {
              metrics = null;
              if (attempt < 5) await page.waitForTimeout(attempt * 1_000);
            }
          } catch (error) {
            if (attempt === 5) throw error;
            await page.waitForLoadState("domcontentloaded").catch(() => undefined);
            await page.locator("body").waitFor({ state: "visible" });
          }
        }
        if (!metrics) throw new Error(`${route} did not produce layout metrics`);

        expect(metrics.horizontalOverflow, `${route} overflows horizontally at ${viewportName}: ${metrics.overflowElements.join(" | ")}`).toBeLessThanOrEqual(1);
        expect(metrics.responsiveContract, `${route} at ${viewportName}: explicit 0px-to-max contract`).toEqual({ min: "0px", max: "100vw" });
        expect(metrics.clientWidth).toBeGreaterThan(0);
        expect(metrics.clientHeight).toBeGreaterThan(0);
        expect(metrics.scrollHeight).toBeGreaterThan(0);

        let domContract: {
          duplicateIds: string[];
          unnamedButtons: string[];
          invalidLinks: string[];
        } | null = null;
        for (let attempt = 1; attempt <= 5 && !domContract; attempt += 1) {
          try {
            domContract = await page.evaluate(() => {
              const visible = (element: Element) => {
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
              };
              const duplicateIds = Array.from(document.querySelectorAll("[id]"))
                .filter(visible)
                .map((element) => element.id)
                .filter((id, index, ids) => ids.indexOf(id) !== index);
              const unnamedButtons = Array.from(document.querySelectorAll("button"))
                .filter(visible)
                .filter((button) => {
                  const label = button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent;
                  return !label?.trim();
                })
                .map((button) => button.outerHTML.slice(0, 180));
              const invalidLinks = Array.from(document.querySelectorAll("a"))
                .filter(visible)
                .filter((link) => !link.getAttribute("href")?.trim())
                .map((link) => link.outerHTML.slice(0, 180));
              return { duplicateIds: [...new Set(duplicateIds)], unnamedButtons, invalidLinks };
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const contextReset = /Execution context was destroyed|most likely because of a navigation/i.test(message);
            if (!contextReset || attempt === 5) throw error;
            await page.waitForLoadState("domcontentloaded").catch(() => undefined);
            await page.locator("body").waitFor({ state: "visible" });
          }
        }
        if (!domContract) throw new Error(`${route} did not produce DOM contract metrics`);
        expect(domContract.duplicateIds, `${route} at ${viewportName}: duplicate DOM ids`).toEqual([]);
        expect(domContract.unnamedButtons, `${route} at ${viewportName}: unnamed visible buttons`).toEqual([]);
        expect(domContract.invalidLinks, `${route} at ${viewportName}: visible links without href`).toEqual([]);
      }
    });
  }
});
