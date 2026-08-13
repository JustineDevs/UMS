/* global describe, it, expect, beforeEach, afterEach */
import {
  arrangePancakePosShipment,
  createPancakePosOrder,
  getPancakePosTrackingUrl,
  registerPancakePosTracking,
} from "../pancake-pos-client";

type FetchCall = {
  input: RequestInfo | URL;
  init?: RequestInit;
};

describe("Pancake POS client", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    PANCAKE_POS_API_URL: process.env.PANCAKE_POS_API_URL,
    PANCAKE_POS_API_KEY: process.env.PANCAKE_POS_API_KEY,
    PANCAKE_POS_SHOP_ID: process.env.PANCAKE_POS_SHOP_ID,
  };

  beforeEach(() => {
    process.env.PANCAKE_POS_API_URL = "https://pos.pages.fm/api/v1";
    process.env.PANCAKE_POS_API_KEY = "pk_test_pancake";
    process.env.PANCAKE_POS_SHOP_ID = "1943092442";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.PANCAKE_POS_API_URL = originalEnv.PANCAKE_POS_API_URL;
    process.env.PANCAKE_POS_API_KEY = originalEnv.PANCAKE_POS_API_KEY;
    process.env.PANCAKE_POS_SHOP_ID = originalEnv.PANCAKE_POS_SHOP_ID;
  });

  it("creates, arranges, and resolves tracking URLs against documented Pancake endpoints", async () => {
    const calls: FetchCall[] = [];
    const responses = [
      {
        ok: true,
        json: async () => ({
          code: 0,
          data: {
            order_id: "order_123",
            system_id: 91,
            tracking_number: "TN123",
            tracking_link: "https://tracking.example/orders/TN123",
          },
        }),
      },
      {
        ok: true,
        json: async () => ({
          code: 0,
          success: true,
          message: "Arrange shipment successfully",
        }),
      },
      {
        ok: true,
        json: async () => ({
          code: 0,
          url: "https://tracking.example/confirm/91",
          success: true,
        }),
      },
    ] as const;
    let index = 0;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input, init });
      return responses[index++] as unknown as Response;
    };

    const created = await createPancakePosOrder({
      orderNumber: "medusa_order_1",
      trackingNumber: "TN123",
      itemCount: 2,
      goodsDescription: "Electric guitar",
      declaredValue: 499.99,
      weightKg: 1.2,
      receiver: {
        name: "Customer Name",
        mobile: "09171234567",
        prov: "Cavite",
        city: "General Trias",
        area: "Navarro",
        address: "Test address",
      },
    });

    expect(created.orderId).toBe("order_123");
    expect(created.systemId).toBe(91);
    expect(created.trackingNumber).toBe("TN123");
    expect(created.trackingUrl).toBe("https://tracking.example/orders/TN123");

    const arrange = await arrangePancakePosShipment("order_123", {
      pickupMethod: "pick_up",
      pickupShift: "closest",
    });
    expect(arrange).toMatchObject({ code: 0, success: true });

    const tracking = await getPancakePosTrackingUrl(91);
    expect(tracking).toMatchObject({
      code: 0,
      url: "https://tracking.example/confirm/91",
      success: true,
    });

    expect(String(calls[0].input)).toContain("/shops/1943092442/orders?api_key=pk_test_pancake");
    expect(String(calls[1].input)).toContain("/shops/1943092442/orders/arrange_shipment?api_key=pk_test_pancake");
    expect(String(calls[2].input)).toContain("/shops/1943092442/orders/get_tracking_url?api_key=pk_test_pancake");
  });

  it("registers a shipment by creating the Pancake order then arranging shipment", async () => {
    const calls: FetchCall[] = [];
    const responses = [
      {
        ok: true,
        json: async () => ({
          code: 0,
          data: {
            order_id: "order_456",
            system_id: 99,
            tracking_number: "TN456",
            tracking_link: "https://tracking.example/orders/TN456",
          },
        }),
      },
      {
        ok: true,
        json: async () => ({
          code: 0,
          success: true,
          message: "Arrange shipment successfully",
        }),
      },
    ] as const;
    let index = 0;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input, init });
      return responses[index++] as unknown as Response;
    };

    const registered = await registerPancakePosTracking({
      orderId: "medusa_order_2",
      trackingNumber: "TN456",
      itemCount: 1,
      goodsDescription: "Bass guitar",
      declaredValue: 399.99,
      weightKg: 1.5,
      receiver: {
        name: "Customer Name",
        mobile: "09171234567",
        prov: "Cavite",
        city: "General Trias",
        area: "Navarro",
        address: "Test address",
      },
    });

    expect(registered.orderId).toBe("order_456");
    expect(registered.systemId).toBe(99);
    expect(registered.trackingUrl).toBe("https://tracking.example/orders/TN456");
    expect(calls).toHaveLength(2);
    expect(String(calls[0].input)).toContain("/shops/1943092442/orders?api_key=pk_test_pancake");
    expect(String(calls[1].input)).toContain("/shops/1943092442/orders/arrange_shipment?api_key=pk_test_pancake");
  });
});
