import { expect, test, type Page } from "@playwright/test";

async function assertPerformanceBudget(
  page: Page,
  route: string,
  viewport: string,
) {
  await page.addInitScript(() => {
    window.__uvsPerformance = { lcp: 0, cls: 0 };
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries.at(-1);
      if (last) window.__uvsPerformance.lcp = last.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    let cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        hadRecentInput?: boolean;
        value?: number;
      })[]) {
        if (!entry.hadRecentInput) cls += entry.value ?? 0;
      }
      window.__uvsPerformance.cls = cls;
    }).observe({ type: "layout-shift", buffered: true });
  });
  const response = await page.goto(route, { waitUntil: "load" });
  expect(response?.ok(), `HTTP failure for ${route}`).toBeTruthy();
  await page.waitForTimeout(2_000);
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming;
    return {
      ttfbMs: navigation.responseStart - navigation.requestStart,
      lcpMs: window.__uvsPerformance.lcp,
      cls: window.__uvsPerformance.cls,
    };
  });
  const maxTtfb = Number(process.env.PERF_MAX_TTFB_MS || 800);
  const maxLcp = Number(process.env.PERF_MAX_LCP_MS || 2500);
  const maxCls = Number(process.env.PERF_MAX_CLS || 0.1);
  console.log(
    JSON.stringify({ route, viewport, ...metrics, maxTtfb, maxLcp, maxCls }),
  );
  expect(metrics.ttfbMs, `TTFB exceeded ${maxTtfb}ms`).toBeLessThanOrEqual(
    maxTtfb,
  );
  expect(
    metrics.lcpMs,
    `LCP exceeded ${maxLcp}ms or was not observed`,
  ).toBeGreaterThan(0);
  expect(metrics.lcpMs).toBeLessThanOrEqual(maxLcp);
  expect(metrics.cls).toBeLessThanOrEqual(maxCls);
}

for (const route of ["/", "/shop", "/collections"]) {
  test(`performance budget: desktop ${route}`, async ({ page }) => {
    await assertPerformanceBudget(page, route, "desktop");
  });
}

test.describe("mobile performance budget", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const route of ["/", "/shop", "/collections"]) {
    test(`performance budget: mobile ${route}`, async ({ page }) => {
      await assertPerformanceBudget(page, route, "mobile");
    });
  }
});

declare global {
  interface Window {
    __uvsPerformance: { lcp: number; cls: number };
  }
}
