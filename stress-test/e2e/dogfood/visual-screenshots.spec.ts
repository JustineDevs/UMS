import fs from "node:fs";
import path from "node:path";
import "../runtime-logs-init";
import { test } from "@playwright/test";

const OUT_DIR = path.join(process.cwd(), "stress-test", "dogfood-output", "screenshots");

const ROUTES: { path: string; file: string }[] = [
  { path: "/", file: "home" },
  { path: "/shop", file: "shop" },
  { path: "/collections", file: "collections" },
  { path: "/checkout", file: "checkout" },
  { path: "/contact", file: "contact" },
  { path: "/help", file: "help" },
  { path: "/faq", file: "faq" },
  { path: "/sign-in", file: "sign-in" },
  { path: "/register", file: "register" },
  { path: "/track", file: "track" },
  { path: "/shipping", file: "shipping" },
  { path: "/search", file: "search" },
  { path: "/wishlist", file: "wishlist" },
  { path: "/terms", file: "terms" },
  { path: "/privacy", file: "privacy" },
  { path: "/cookies", file: "cookies" },
  { path: "/returns", file: "returns" },
  { path: "/preferences", file: "preferences" },
  { path: "/accessibility", file: "accessibility" },
  { path: "/sitemap", file: "sitemap" },
  { path: "/account", file: "account" },
];

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

test.describe.configure({ mode: "serial" });

for (const { path: routePath, file } of ROUTES) {
  test(`screenshot ${routePath || "/"}`, async ({ page }) => {
    await page.goto(routePath, { waitUntil: "load" });
    await page.locator("body").waitFor({ state: "visible" });
    await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());
    const out = path.join(OUT_DIR, `${file}.png`);
    await page.screenshot({ path: out, fullPage: true });
  });
}

test("screenshot first catalog PDP", async ({ page }) => {
  await page.goto("/shop", { waitUntil: "load" });
  const first = page.locator("[data-product-slug]").first();
  try {
    await first.waitFor({ state: "visible", timeout: 90_000 });
  } catch {
    test.skip(true, "No products for PDP screenshot (run pnpm e2e:prep:medusa).");
  }
  const slug = (await first.getAttribute("data-product-slug"))?.trim();
  if (!slug) {
    test.skip(true, "No product slug on shop page.");
  }
  await page.goto(`/shop/${slug}`, { waitUntil: "load" });
  await page.locator("body").waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());
  const out = path.join(OUT_DIR, "shop-pdp.png");
  await page.screenshot({ path: out, fullPage: true });
});
