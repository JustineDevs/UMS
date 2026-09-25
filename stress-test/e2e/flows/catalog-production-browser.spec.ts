import { expect, test } from "@playwright/test";

test("production catalog card, PDP identity, price, media, and cart persistence", async ({ page }) => {
  await page.goto("/shop", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.removeItem("ums-commerce-cart-v3");
    localStorage.removeItem("ums-commerce-cart-v5");
  });
  await page.reload({ waitUntil: "networkidle" });

  const productLink = page.locator("[data-product-slug]").first();
  await expect(productLink).toBeVisible({ timeout: 45_000 });
  const slug = await productLink.getAttribute("data-product-slug");
  expect(slug).toBeTruthy();
  await expect(productLink).toHaveAttribute("href", `/shop/${slug}`);
  await expect(productLink.locator("img").first()).toBeVisible();
  await expect(productLink).toContainText(/PHP\s+[\d,]+/);
  await expect(productLink).toContainText("VAT incl.");

  await productLink.click();
  await expect(page).toHaveURL(new RegExp(`/shop/${slug}$`));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("pdp-price")).toContainText(/PHP\s+[\d,]+/);
  await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/shop");

  const add = page.locator('[data-testid="pdp-add-to-bag"]:visible').first();
  await expect(add).toBeEnabled({ timeout: 45_000 });
  await add.click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole("spinbutton", { name: /quantity for/i }).first()).toHaveValue("1");

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("spinbutton", { name: /quantity for/i }).first()).toHaveValue("1");
});
