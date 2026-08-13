import { test, expect } from "@playwright/test";

const adminBase = process.env.PLAYWRIGHT_ADMIN_URL ?? "http://localhost:3001";
const storefrontBase = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

test.describe("admin and storefront boundary regressions", () => {
  test("admin auth keeps its callback on the admin origin", async ({ page }) => {
    await page.goto(`${adminBase}/admin`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/sign-in\?callbackUrl=/i);

    const callback = new URL(page.url()).searchParams.get("callbackUrl");
    expect(callback).toBe("/admin");
    expect(page.url()).toMatch(/^http:\/\/localhost:3001\/sign-in\?/);
  });

  test("product specifications fill the service-information space", async ({ page }) => {
    await page.goto(`${storefrontBase}/shop/merch-pack`, { waitUntil: "domcontentloaded" });

    const serviceInfo = page.getByRole("region", { name: "Service information" });
    const specifications = page.locator('[data-pdp-section="specifications"]:visible').first();

    await expect(serviceInfo).toBeVisible({ timeout: 120_000 });
    await expect(specifications).toBeVisible({ timeout: 120_000 });

    const serviceBox = await serviceInfo.boundingBox();
    const specificationBox = await specifications.boundingBox();
    expect(serviceBox).not.toBeNull();
    expect(specificationBox).not.toBeNull();
    expect(specificationBox!.y).toBeGreaterThan(serviceBox!.y + serviceBox!.height);
  });

  test("product details keep the original stack with separated specifications", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${storefrontBase}/shop/merch-pack`, { waitUntil: "domcontentloaded" });

    const overview = page.locator('[data-pdp-section="overview"]:visible').first();
    const buildNotes = page.locator('[data-pdp-section="build"]:visible').first();
    const shipping = page.locator('[data-pdp-section="shipping"]:visible').first();
    const description = page.locator('[data-pdp-section="description"]:visible').first();
    const specifications = page.locator('[data-pdp-section="specifications"]:visible').first();

    await expect(overview).toBeVisible({ timeout: 120_000 });
    await expect(buildNotes).toBeVisible();
    await expect(shipping).toBeVisible();
    await expect(description).toBeVisible();
    await expect(specifications).toBeVisible();

    const left = await overview.boundingBox();
    const right = await description.boundingBox();
    const build = await buildNotes.boundingBox();
    const shippingBox = await shipping.boundingBox();
    const rightSpecs = await specifications.boundingBox();
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    expect(build).not.toBeNull();
    expect(shippingBox).not.toBeNull();
    expect(rightSpecs).not.toBeNull();
    expect(Math.abs(left!.x - right!.x)).toBeLessThan(2);
    expect(rightSpecs!.x).toBeGreaterThan(left!.x);
    expect(build!.y).toBeGreaterThan(left!.y);
    expect(shippingBox!.y).toBeGreaterThan(build!.y);

    const serviceInfo = page.getByRole("region", { name: "Service information" });
    const serviceBox = await serviceInfo.boundingBox();
    expect(serviceBox).not.toBeNull();
    expect(rightSpecs!.y).toBeGreaterThan(serviceBox!.y + serviceBox!.height);
  });
});
