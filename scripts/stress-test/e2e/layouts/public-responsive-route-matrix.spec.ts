import { test, expect } from "@playwright/test";

import { RESPONSIVE_BANDS, VIEWPORTS, setViewport } from "../helpers/viewports";

/**
 * Every public page is exercised at one representative width in every
 * explicit 0px-to-max band. Dynamic routes intentionally use stable fixture
 * slugs or their not-found state; both are real compositions that must remain
 * bounded and usable.
 */
const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/accessibility",
  "/cart",
  "/checkout",
  "/checkout/hosted-return",
  "/checkout/stripe-return",
  "/collections",
  "/collections/guitars",
  "/contact",
  "/cookies",
  "/faq",
  "/help",
  "/login",
  "/maintenance",
  "/onboarding",
  "/order-confirmation/e2e-order",
  "/p/e2e-native-guitar",
  "/preferences",
  "/privacy",
  "/register",
  "/returns",
  "/search",
  "/shipping",
  "/shop",
  "/shop/e2e-native-guitar",
  "/sign-in",
  "/site-map",
  "/terms",
  "/track",
  "/track/e2e-order",
  "/variant-guide",
  "/warranty",
  "/wishlist",
  "/account",
  "/account/addresses",
  "/account/banks-cards",
  "/account/notifications",
  "/account/notifications/order",
  "/account/notifications/promotions",
  "/account/orders",
  "/account/orders/e2e-order",
  // Use the same stable order-id shape the return page accepts. The route is
  // still guest-audited (and therefore redirects to sign-in), but it must not
  // be mistaken for an invalid order and rendered as a 404.
  "/account/orders/order_e2e-order/return",
  "/account/password",
  "/account/preferences",
  "/account/privacy",
  "/account/profile",
  "/account/vouchers",
  "/blog",
  "/blog/preview",
  "/blog/unknown-e2e-post",
] as const;

async function gotoForResponsiveAudit(page: import("@playwright/test").Page, route: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const transientTransport = /ERR_ABORTED|ERR_CONNECTION_RESET|ECONNRESET|page\.goto: Timeout/i.test(message);
      if (!transientTransport || attempt === 3) throw error;
      // Parallel route compilation can briefly reset a navigation. Retry the
      // same route instead of turning a transport blip into a layout finding.
      await page.waitForTimeout(attempt * 750);
    }
  }
}

test.describe("@layout @storefront @responsive public route matrix", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} stays bounded and composes at every width band`, async ({ page }) => {
      page.setDefaultTimeout(15_000);
      page.setDefaultNavigationTimeout(45_000);

      for (const band of RESPONSIVE_BANDS) {
        await setViewport(page, band.representative as keyof typeof VIEWPORTS);
        await gotoForResponsiveAudit(page, route);
        if (route === "/account") {
          await page.waitForURL(
            /(?:\/account\/profile(?:\?|$)|\/login\?callbackUrl=%2Faccount(?:%2Fprofile)?(?:$|&))/,
            { timeout: 60_000 },
          );
          await page.waitForLoadState("domcontentloaded");
        }
        if (route === "/sign-in") {
          await page.waitForURL(/\/login(?:\?|$)/, { timeout: 60_000 });
          await page.waitForLoadState("domcontentloaded");
        }
        if (route === "/account/orders/order_e2e-order/return") {
          // This protected route either redirects a guest to login or renders
          // the return form for an authenticated E2E session. Wait for either
          // settled state before reading the DOM; otherwise an auth transition
          // can destroy the evaluation context mid-audit.
          await page.waitForURL(
            /(?:\/login\?callbackUrl=|\/account\/orders\/order_e2e-order\/return(?:\?|$))/,
            { timeout: 60_000 },
          );
          await page.waitForLoadState("domcontentloaded");
        }
        await expect(page.locator("body")).toBeVisible();
        await expect
          .poll(
            async () =>
              page.locator("#main-content").evaluateAll((elements) => {
                const visible = elements.filter((element) => {
                  const style = window.getComputedStyle(element);
                  const rect = element.getBoundingClientRect();
                  return style.display !== "none" && style.visibility !== "hidden" && rect.height > 0;
                });
                return visible.length > 0 && visible.some((element) => !/^Loading(?:\u2026|\.\.\.)?$/i.test((element.textContent ?? "").trim()));
              }).catch(() => false),
            { timeout: 60_000, message: `${route} at ${band.name}: route settled` },
          )
          .toBe(true);

        const collectState = () => page.evaluate(() => {
          const root = document.documentElement;
          const body = document.body;
          const rootStyles = getComputedStyle(root);
          const mainContent = Array.from(document.querySelectorAll("#main-content"));
          const visibleMainContent = mainContent.filter((element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
          });
          const visibleErrors = Array.from(document.querySelectorAll("body *"))
            .filter((element) => {
              const style = window.getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
            })
            .filter((element) => /Unhandled Runtime Error|Application error/i.test(element.textContent ?? ""))
            .map((element) => (element.textContent ?? "").trim().slice(0, 120));
          const wideShells = Array.from(document.querySelectorAll(".storefront-content-wide"))
            .map((element) => Math.round(element.getBoundingClientRect().width))
            .filter((width) => width > 0);
          return {
            viewport: window.innerWidth,
            responsiveContract: {
              min: rootStyles.getPropertyValue("--responsive-viewport-min").trim(),
              max: rootStyles.getPropertyValue("--responsive-viewport-max").trim(),
            },
            rootScrollWidth: root.scrollWidth,
            rootClientWidth: root.clientWidth,
            bodyScrollWidth: body.scrollWidth,
            overflowSources: Array.from(document.querySelectorAll<HTMLElement>("body *"))
              .map((element) => {
                const rect = element.getBoundingClientRect();
                return { tag: element.tagName.toLowerCase(), id: element.id, className: String(element.className).slice(0, 100), right: Math.round(rect.right), left: Math.round(rect.left) };
              })
              .filter(({ right, left }) => right > window.innerWidth + 1 || left < -1)
              .sort((a, b) => Math.max(b.right - window.innerWidth, -b.left) - Math.max(a.right - window.innerWidth, -a.left))
              .slice(0, 5),
            mainVisible: visibleMainContent.length === 1,
            mobileMenuTrigger: Boolean(document.querySelector('[data-testid="mobile-menu-trigger"]')),
            wideShells,
            visibleErrors,
            duplicateIds: Array.from(document.querySelectorAll("[id]"))
              .filter((element) => {
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
              })
              .map((element) => element.id)
              .filter((id, index, ids) => ids.indexOf(id) !== index),
            unnamedButtons: Array.from(document.querySelectorAll("button"))
              .filter((element) => {
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
              })
              .filter((button) => {
                const label = button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent;
                return !label?.trim();
              })
              .map((button) => button.outerHTML.slice(0, 180)),
            invalidLinks: Array.from(document.querySelectorAll("a"))
              .filter((element) => {
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
              })
              .filter((link) => !link.getAttribute("href")?.trim())
              .map((link) => link.outerHTML.slice(0, 180)),
          };
        });
        let state;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            state = await collectState();
            break;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const contextReset = /Execution context was destroyed|most likely because of a navigation/i.test(message);
            if (!contextReset || attempt === 3) throw error;
            await gotoForResponsiveAudit(page, route);
            await expect
              .poll(
                async () => page.locator("#main-content").evaluateAll((elements) => elements.some((element) => {
                  const style = window.getComputedStyle(element);
                  const rect = element.getBoundingClientRect();
                  return style.display !== "none" && style.visibility !== "hidden" && rect.height > 0 && !/^Loading(?:\u2026|\.\.\.)?$/i.test((element.textContent ?? "").trim());
                })).catch(() => false),
                { timeout: 60_000, message: `${route} at ${band.name}: route settled after navigation reset` },
              )
              .toBe(true);
          }
        }
        if (!state) throw new Error(`${route} at ${band.name}: responsive state was not collected`);

        expect(state.rootScrollWidth, `${route} at ${band.name}: root overflow`).toBeLessThanOrEqual(state.rootClientWidth + 1);
        expect(state.bodyScrollWidth, `${route} at ${band.name}: body overflow (${JSON.stringify(state.overflowSources)})`).toBeLessThanOrEqual(state.rootClientWidth + 1);
        expect(state.responsiveContract, `${route} at ${band.name}: explicit 0px-to-max contract`).toEqual({ min: "0px", max: "100vw" });
        expect(state.mainVisible, `${route} at ${band.name}: main content`).toBeTruthy();
        expect(state.visibleErrors, `${route} at ${band.name}: runtime error`).toEqual([]);
        expect(state.wideShells.every((width) => width <= 1600), `${route} at ${band.name}: max-width cap`).toBeTruthy();
        expect(state.duplicateIds, `${route} at ${band.name}: duplicate DOM ids`).toEqual([]);
        expect(state.unnamedButtons, `${route} at ${band.name}: unnamed visible buttons`).toEqual([]);
        expect(state.invalidLinks, `${route} at ${band.name}: visible links without href`).toEqual([]);

        if (state.viewport < 640) {
          expect(state.mobileMenuTrigger, `${route} at ${band.name}: mobile navigation`).toBeTruthy();
        }
      }
    });
  }
});
