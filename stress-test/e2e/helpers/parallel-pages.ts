import type { Browser, BrowserContext, Page } from "@playwright/test";

export type ParallelPageJob<T> = (page: Page, index: number) => Promise<T>;

/**
 * Run the same scenario in parallel browser pages (different contexts isolate cookies).
 */
export async function withParallelPages<T>(
  browser: Browser,
  count: number,
  fn: ParallelPageJob<T>,
): Promise<T[]> {
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  try {
    for (let i = 0; i < count; i++) {
      const ctx = await browser.newContext();
      contexts.push(ctx);
      pages.push(await ctx.newPage());
    }
    return await Promise.all(pages.map((p, i) => fn(p, i)));
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    for (const c of contexts) await c.close().catch(() => {});
  }
}
