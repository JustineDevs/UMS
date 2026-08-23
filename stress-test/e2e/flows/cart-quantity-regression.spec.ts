import { test, expect } from "@playwright/test";

test("cart ignores legacy max-stock state and supports exact inline quantity edits", async ({
  page,
}) => {
  await page.route("**/api/cart/reconcile", async (route) => {
    const body = (await route.request().postDataJSON()) as {
      lines?: Array<{ variantId: string; quantity: number }>;
    };
    const lines = body.lines ?? [];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        currency: "PHP",
        cartTotal: lines.reduce(
          (total, line) => total + line.quantity * 100,
          0,
        ),
        lines: lines.map((line) => ({
          ...line,
          slug: "canary",
          name: "Canary",
          sku: "CANARY",
          type: "Default",
          finish: "",
          price: 100,
          currencyCode: "PHP",
          availableQuantity: 5,
          status: line.quantity > 5 ? "over_limit" : "current",
        })),
      }),
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem(
      "ums-commerce-cart-v3",
      JSON.stringify([
        {
          variantId: "legacy",
          quantity: 866,
          name: "Legacy",
          slug: "legacy",
          sku: "legacy",
          type: "",
          finish: "",
          price: 1,
        },
      ]),
    );
    if (!localStorage.getItem("ums-commerce-cart-v4")) {
      localStorage.setItem(
        "ums-commerce-cart-v4",
        JSON.stringify([
          {
            variantId: "v1",
            quantity: 1,
            name: "Canary",
            slug: "canary",
            sku: "CANARY",
            type: "Default",
            finish: "",
            price: 100,
            availableQuantity: 900,
          },
        ]),
      );
    }
  });

  await page.goto("/cart");
  const quantity = page.getByRole("spinbutton", {
    name: /quantity for canary/i,
  });
  await expect(quantity).toHaveValue("1", { timeout: 15000 });
  await expect(page.getByText("Legacy")).toHaveCount(0);

  await quantity.fill("12");
  await quantity.press("Enter");
  await expect(quantity).toHaveValue("12");
  await expect(
    page.getByText("Only 5 available. Reduce the quantity before checkout."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resolve unavailable items" }),
  ).toBeDisabled();

  await page.reload();
  await expect(
    page.getByRole("spinbutton", { name: /quantity for canary/i }),
  ).toHaveValue("12");

  const reloadedQuantity = page.getByRole("spinbutton", {
    name: /quantity for canary/i,
  });
  await reloadedQuantity.fill("0");
  await reloadedQuantity.press("Enter");
  await expect(page.getByText("Your bag is empty.")).toBeVisible();
});

test("bound cart quantity edits synchronize the server line without stock clamping", async ({
  page,
}) => {
  let updateRequest: { variantId?: string; quantity?: number } | null = null;
  await page.route("**/api/cart/resume", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        cartId: "cart_bound_fixture",
        lines: [],
        available: true,
      }),
    }),
  );
  await page.route("**/api/cart/reconcile", async (route) => {
    const body = (await route.request().postDataJSON()) as {
      lines?: Array<{ variantId: string; quantity: number }>;
    };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        currency: "PHP",
        cartTotal: (body.lines ?? []).reduce(
          (total, line) => total + line.quantity * 100,
          0,
        ),
        lines: (body.lines ?? []).map((line) => ({
          ...line,
          slug: "bound-fixture",
          name: "Bound fixture",
          sku: "BOUND",
          type: "Default",
          finish: "",
          price: 100,
          currencyCode: "PHP",
          availableQuantity: 5,
          status: "current",
        })),
      }),
    });
  });
  await page.route("**/api/cart/line", async (route) => {
    if (route.request().method() === "PUT") {
      updateRequest = (await route
        .request()
        .postDataJSON()) as typeof updateRequest;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, updated: 1 }),
      });
      return;
    }
    await route.continue();
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "ums-commerce-cart-v4",
      JSON.stringify([
        {
          variantId: "bound-v1",
          quantity: 1,
          name: "Bound fixture",
          slug: "bound-fixture",
          sku: "BOUND",
          type: "Default",
          finish: "",
          price: 100,
        },
      ]),
    );
  });

  await page.goto("/cart");
  await expect(page.locator("[data-cart-source]")).toHaveAttribute(
    "data-cart-source",
    "local-draft",
  );
  const quantity = page.getByRole("spinbutton", {
    name: /quantity for bound fixture/i,
  });
  await expect(quantity).toHaveValue("1", { timeout: 15000 });
  await quantity.fill("3");
  await quantity.press("Enter");
  await expect(quantity).toHaveValue("3");
  expect(updateRequest).toEqual({ variantId: "bound-v1", quantity: 3 });
});

test("cart keeps the bag visible and blocks checkout when reconciliation is unavailable", async ({
  page,
}) => {
  await page.route("**/api/cart/reconcile", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "temporarily unavailable" }),
    }),
  );
  await page.addInitScript(() => {
    localStorage.setItem(
      "ums-commerce-cart-v4",
      JSON.stringify([
        {
          variantId: "outage-v1",
          quantity: 1,
          name: "Outage fixture",
          slug: "outage-fixture",
          sku: "OUTAGE",
          type: "Default",
          finish: "",
          price: 100,
        },
      ]),
    );
  });

  await page.goto("/cart");
  await expect(page.getByText("Outage fixture")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId("cart-total-source")).toHaveText(
    /Estimate from your saved bag/,
  );
  await expect(
    page.getByText(
      "Prices and availability could not be refreshed. Refresh before checkout.",
    ),
  ).toBeVisible();
  const checkout = page.getByRole("button", {
    name: "Refresh before checkout",
  });
  await expect(checkout).toBeDisabled();
  await expect(checkout).toHaveAttribute(
    "aria-describedby",
    "cart-checkout-blocked",
  );
});

test("cart mobile actions and trust links keep thumb-sized targets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/cart/reconcile", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        currency: "PHP",
        cartTotal: 100,
        lines: [
          {
            variantId: "mobile-v1",
            quantity: 1,
            slug: "mobile-item",
            name: "Mobile item",
            sku: "MOBILE",
            type: "Default",
            finish: "",
            price: 100,
            currencyCode: "PHP",
            availableQuantity: 5,
            status: "current",
          },
        ],
      }),
    }),
  );
  await page.addInitScript(() => {
    localStorage.setItem(
      "ums-commerce-cart-v4",
      JSON.stringify([
        {
          variantId: "mobile-v1",
          quantity: 1,
          name: "Mobile item",
          slug: "mobile-item",
          sku: "MOBILE",
          type: "Default",
          finish: "",
          price: 100,
        },
      ]),
    );
  });

  await page.goto("/cart", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("spinbutton", { name: /quantity for mobile item/i }),
  ).toBeVisible();
  for (const locator of [
    page.getByRole("button", { name: "Decrease quantity" }),
    page.getByRole("spinbutton", { name: /quantity for mobile item/i }),
    page.getByRole("button", { name: "Increase quantity" }),
    page.getByRole("button", { name: /Remove mobile item/i }),
    page.getByRole("link", { name: "Proceed to checkout" }),
    page.getByRole("link", { name: "Review our return policy" }),
    page.getByRole("link", { name: "Contact customer support" }),
  ]) {
    await expect(locator).toBeVisible();
    expect(
      await locator.evaluate((node) =>
        Math.round(node.getBoundingClientRect().height),
      ),
    ).toBeGreaterThanOrEqual(44);
  }
});

test("cart identifies unavailable variants instead of presenting a stock count", async ({
  page,
}) => {
  await page.route("**/api/cart/reconcile", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        currency: "PHP",
        cartTotal: 0,
        lines: [
          {
            variantId: "gone-v1",
            quantity: 1,
            slug: "gone-item",
            name: "Discontinued item",
            price: 100,
            currencyCode: "PHP",
            availableQuantity: 0,
            status: "unavailable",
          },
        ],
      }),
    }),
  );
  await page.addInitScript(() => {
    localStorage.setItem(
      "ums-commerce-cart-v4",
      JSON.stringify([
        {
          variantId: "gone-v1",
          quantity: 1,
          name: "Discontinued item",
          slug: "gone-item",
          sku: "GONE",
          type: "Default",
          finish: "",
          price: 100,
        },
      ]),
    );
  });

  await page.goto("/cart");
  await expect(
    page.getByText(
      "This item is no longer available. Remove it before checkout.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resolve unavailable items" }),
  ).toBeDisabled();
});

test("cart replaces stale display pricing with the authoritative reconciliation", async ({
  page,
}) => {
  await page.route("**/api/cart/reconcile", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        currency: "PHP",
        cartTotal: 250,
        reconciledAt: "2026-08-23T12:00:00.000Z",
        lines: [
          {
            variantId: "stale-price",
            quantity: 1,
            slug: "stale-price",
            name: "Freshly priced item",
            sku: "FRESH-1",
            type: "Default",
            finish: "",
            price: 250,
            currencyCode: "PHP",
            availableQuantity: 10,
            status: "current",
          },
        ],
      }),
    }),
  );
  await page.addInitScript(() => {
    localStorage.setItem(
      "ums-commerce-cart-v4",
      JSON.stringify([
        {
          variantId: "stale-price",
          quantity: 1,
          name: "Stale item",
          slug: "stale-price",
          sku: "STALE-1",
          type: "Default",
          finish: "",
          price: 100,
        },
      ]),
    );
  });
  await page.goto("/cart", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Freshly priced item")).toBeVisible();
  await expect(page.getByTestId("cart-total-source")).toHaveText(
    /Updated from the live catalog/,
  );
  await expect(page.getByTestId("cart-last-reconciled")).toHaveText(
    /Last checked/,
  );
  await expect(page.getByTestId("authoritative-cart-total")).toHaveAttribute(
    "data-total-source",
    "medusa-reconciled",
  );
  await expect(page.getByTestId("authoritative-cart-total")).toContainText(
    "250",
  );
});

test("cart exposes safe per-line reconciliation errors", async ({ page }) => {
  await page.route("**/api/cart/reconcile", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Catalog reconciliation is temporarily unavailable",
        lines: [{ variantId: "fixture-error", status: "error" }],
      }),
    }),
  );
  await page.addInitScript(() => {
    localStorage.setItem(
      "ums-commerce-cart-v4",
      JSON.stringify([
        {
          variantId: "fixture-error",
          quantity: 1,
          name: "Error fixture",
          slug: "error-fixture",
          sku: "ERROR-1",
          type: "Default",
          finish: "",
          price: 100,
        },
      ]),
    );
  });
  await page.goto("/cart", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("This item could not be refreshed. Try again."),
  ).toBeVisible();
  await expect(page.getByTestId("authoritative-cart-total")).toHaveAttribute(
    "data-total-source",
    "local-cache",
  );
  await expect(page.getByTestId("authoritative-cart-total")).toHaveAttribute(
    "aria-label",
    "Estimated cart total; refresh before checkout",
  );
  await expect(
    page.locator("[data-price-source=local-cache]").first(),
  ).toHaveAttribute(
    "aria-label",
    "Estimated price for Error fixture; refresh before checkout",
  );
});

test("cart reconciles a quantity update received from another tab", async ({
  page,
  context,
}) => {
  await context.route("**/api/cart/reconcile", async (route) => {
    const body = (await route.request().postDataJSON()) as {
      lines?: Array<{ variantId: string; quantity: number }>;
    };
    const lines = body.lines ?? [];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        currency: "PHP",
        cartTotal: lines.reduce(
          (total, line) => total + line.quantity * 100,
          0,
        ),
        lines: lines.map((line) => ({
          ...line,
          slug: "cross-tab",
          name: "Cross tab",
          sku: "CROSS-TAB",
          type: "Default",
          finish: "",
          price: 100,
          currencyCode: "PHP",
          availableQuantity: 10,
          status: "current",
        })),
      }),
    });
  });
  await context.addInitScript(() => {
    localStorage.setItem(
      "ums-commerce-cart-v4",
      JSON.stringify([
        {
          variantId: "cross-tab-v1",
          quantity: 1,
          name: "Cross tab",
          slug: "cross-tab",
          sku: "CROSS-TAB",
          type: "Default",
          finish: "",
          price: 100,
        },
      ]),
    );
  });

  await page.goto("/cart");
  await expect(
    page.getByRole("spinbutton", { name: /quantity for cross tab/i }),
  ).toHaveValue("1");
  const secondTab = await context.newPage();
  await secondTab.goto("/cart");
  const secondQuantity = secondTab.getByRole("spinbutton", {
    name: /quantity for cross tab/i,
  });
  await expect(secondQuantity).toHaveValue("1");

  const firstQuantity = page.getByRole("spinbutton", {
    name: /quantity for cross tab/i,
  });
  await firstQuantity.fill("3");
  await firstQuantity.press("Enter");
  await expect(secondQuantity).toHaveValue("3", { timeout: 15_000 });
  await secondTab.close();
});
