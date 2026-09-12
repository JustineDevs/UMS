import {
  formatOrderPlacedSms,
  formatOrderShippedSms,
  safeTrackingUrl,
} from "../semaphore-sms-client";

describe("SMS tracking-link safety", () => {
  it("accepts only an HTTPS opaque tracking capability", () => {
    expect(safeTrackingUrl("https://shop.example/track/cap_v3.opaque")).toBe(
      "https://shop.example/track/cap_v3.opaque",
    );
    expect(safeTrackingUrl("http://shop.example/track/cap_v3.opaque")).toBeNull();
    expect(safeTrackingUrl("https://shop.example/track/order_123")).toBeNull();
    expect(safeTrackingUrl("https://shop.example/track/cap_v3.opaque?t=raw")).toBeNull();
  });

  it("omits unsafe tracking links from order and shipment messages", () => {
    const unsafe = "https://shop.example/track/order_123";
    expect(
      formatOrderPlacedSms({
        displayId: 42,
        total: 125000,
        currencyCode: "PHP",
        trackingUrl: unsafe,
      }),
    ).not.toContain(unsafe);
    expect(
      formatOrderShippedSms({
        displayId: 42,
        trackingNumber: "JT123",
        trackingUrl: unsafe,
      }),
    ).not.toContain(unsafe);
  });

  it("includes a valid opaque link in both message templates", () => {
    const safe = "https://shop.example/track/cap_v3.opaque";
    expect(
      formatOrderPlacedSms({
        displayId: 42,
        total: 125000,
        currencyCode: "PHP",
        trackingUrl: safe,
      }),
    ).toContain(`Track: ${safe}`);
    expect(
      formatOrderShippedSms({ displayId: 42, trackingUrl: safe }),
    ).toContain(`Track: ${safe}`);
  });
});
