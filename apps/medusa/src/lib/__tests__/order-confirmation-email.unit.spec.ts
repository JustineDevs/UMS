import { buildRichHtml } from "../../subscribers/order-placed-resend-email";

describe("order confirmation email privacy", () => {
  it("does not expose the internal Medusa order id", () => {
    const html = buildRichHtml({
      order: {
        id: "order_internal_123",
        display_id: 42,
        total: 125000,
        currency_code: "php",
      },
      orderDisplayLabel: "42",
      trackingUrl: "https://shop.example/track/cap_v3.opaque",
      brandName: "Universal Music Store",
    });

    expect(html).toContain("#42");
    expect(html).toContain("/track/cap_v3.opaque");
    expect(html).not.toContain("order_internal_123");
    expect(html).not.toContain("Order ID:");
  });
});
