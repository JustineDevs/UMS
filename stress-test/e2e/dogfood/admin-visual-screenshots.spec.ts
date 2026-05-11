import fs from "node:fs";
import path from "node:path";
import "../runtime-logs-init";
import { test } from "@playwright/test";

const OUT_DIR = path.join(process.cwd(), "stress-test", "dogfood-output", "screenshots");

/**
 * Admin app (Next.js) on 3001. `/admin/*` uses NextAuth middleware; without a session,
 * requests redirect to sign-in (often with `callbackUrl` in the query). Layout is the
 * same; filenames map to the route you tried to open for traceability.
 */
const ADMIN_ROUTES: { path: string; file: string }[] = [
  { path: "/api/auth/signin", file: "admin-sign-in" },
  { path: "/admin", file: "admin-home" },
  { path: "/admin/orders", file: "admin-orders" },
  { path: "/admin/inventory", file: "admin-inventory" },
  { path: "/admin/pos", file: "admin-pos" },
];

test.use({ baseURL: "http://localhost:3001" });

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

test.describe.configure({ mode: "serial" });

for (const { path: routePath, file } of ADMIN_ROUTES) {
  test(`admin screenshot ${routePath}`, async ({ page }) => {
    await page.goto(routePath, { waitUntil: "load" });
    await page.locator("body").waitFor({ state: "attached" });
    await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());
    const out = path.join(OUT_DIR, `${file}.png`);
    await page.screenshot({ path: out, fullPage: true });
  });
}
