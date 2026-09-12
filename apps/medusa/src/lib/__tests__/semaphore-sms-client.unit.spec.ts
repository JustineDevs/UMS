import { formatOrderPlacedSms, formatOrderShippedSms } from "../semaphore-sms-client";

describe("Semaphore tracking links", () => {
  it("only includes opaque HTTPS tracking capabilities", () => {
    const unsafe = formatOrderPlacedSms({
      displayId: 12,
      total: 1000,
      currencyCode: "PHP",
      trackingUrl: "http://shop.test/track/order_12",
    });
    expect(unsafe).not.toContain("Track:");

    const safe = formatOrderShippedSms({
      displayId: 12,
      trackingNumber: "JT123",
      trackingUrl: "https://shop.test/track/cap_v3.token",
    });
    expect(safe).toContain("https://shop.test/track/cap_v3.token");
  });

  it("rejects query-bearing capabilities before sending them", () => {
    const message = formatOrderPlacedSms({
      displayId: 12,
      total: 1000,
      currencyCode: "PHP",
      trackingUrl: "https://shop.test/track/cap_v3.token?orderId=order_12",
    });
    expect(message).not.toContain("order_12");
    expect(message).not.toContain("Track:");
  });
});
