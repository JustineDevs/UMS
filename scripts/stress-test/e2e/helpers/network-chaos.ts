import type { Page, Route } from "@playwright/test";

type ChaosProfile = "slow-json" | "abort-once" | "offline-burst";

/**
 * Slow down JSON API responses to stress loading states (non-fatal).
 */
export async function applySlowNetwork(
  page: Page,
  pattern: string | RegExp,
  delayMs: number,
): Promise<void> {
  await page.route(pattern, async (route: Route) => {
    await new Promise((r) => setTimeout(r, delayMs));
    await route.continue();
  });
}

/**
 * Abort the first matching request, then continue normal traffic (retry / error UI path).
 */
export async function abortFirstMatch(
  page: Page,
  pattern: string | RegExp,
): Promise<{ aborted: boolean }> {
  let done = false;
  await page.route(pattern, async (route: Route) => {
    if (!done) {
      done = true;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  return { aborted: true };
}

export async function removeRoutes(page: Page): Promise<void> {
  try {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  } catch {
    await page.unroute("**/*").catch(() => {});
  }
}
