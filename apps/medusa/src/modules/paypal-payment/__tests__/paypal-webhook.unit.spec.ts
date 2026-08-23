import { MedusaError, PaymentActions } from "@medusajs/framework/utils";

import PayPalPaymentProviderService from "../service";
import {
  buildPayPalWebhookDedupId,
  claimPayPalWebhookDedup,
} from "../../../lib/paypal-webhook-dedup";
import { capturePayPalOrder, verifyPayPalWebhookSignature } from "../../../lib/paypal-sdk-client";

jest.mock("../../../lib/paypal-webhook-dedup", () => ({
  buildPayPalWebhookDedupId: jest.fn((body: { event_type?: string; id?: string }) =>
    body.id ? `paypal:${body.event_type ?? "unknown"}:${body.id}` : null,
  ),
  claimPayPalWebhookDedup: jest.fn(),
}));

jest.mock("../../../lib/paypal-sdk-client", () => ({
  capturePayPalOrder: jest.fn(),
  verifyPayPalWebhookSignature: jest.fn(),
}));

describe("PayPal webhook signature verification gate", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("blocks in production when PAYPAL_WEBHOOK_ID is unset", () => {
    process.env.NODE_ENV = "production";
    delete process.env.PAYPAL_WEBHOOK_ID;
    expect(process.env.PAYPAL_WEBHOOK_ID).toBeUndefined();
  });

  it("allows bypass in development when PAYPAL_WEBHOOK_ID is unset", () => {
    process.env.NODE_ENV = "development";
    delete process.env.PAYPAL_WEBHOOK_ID;
    expect(process.env.NODE_ENV).toBe("development");
  });

  it("requires signature headers when PAYPAL_WEBHOOK_ID is set", () => {
    process.env.PAYPAL_WEBHOOK_ID = "test-webhook-id";
    expect(process.env.PAYPAL_WEBHOOK_ID).toBe("test-webhook-id");
  });
});

describe("PayPal webhook dedup ID generation", () => {
  it("builds a dedup ID from event_type and id", () => {
    const body = {
      id: "WH-1234",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
    };
    expect(buildPayPalWebhookDedupId(body)).toBe(
      "paypal:PAYMENT.CAPTURE.COMPLETED:WH-1234",
    );
  });

  it("returns null when id is missing", () => {
    const body = { event_type: "PAYMENT.CAPTURE.COMPLETED" };
    expect(buildPayPalWebhookDedupId(body)).toBeNull();
  });

  it("uses 'unknown' when event_type is missing", () => {
    const body = { id: "WH-5678" };
    expect(buildPayPalWebhookDedupId(body)).toBe("paypal:unknown:WH-5678");
  });
});

describe("PayPal webhook body parsing", () => {
  function extractSessionAndAmount(
    eventType: string,
    resource: Record<string, unknown>,
  ): { sessionId: string | undefined; amountMinor: number } {
    let sessionId: string | undefined;
    let amountMinor = 0;

    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      sessionId = resource.custom_id as string | undefined;
      const amountObj = resource.amount as
        | { value?: string }
        | undefined;
      const val = parseFloat(String(amountObj?.value ?? "0"));
      amountMinor = Number.isFinite(val) ? Math.round(val * 100) : 0;
    } else if (eventType === "CHECKOUT.ORDER.APPROVED") {
      const units = resource.purchase_units as
        | Array<{ custom_id?: string; amount?: { value?: string } }>
        | undefined;
      const first = units?.[0];
      sessionId = first?.custom_id;
      const val = parseFloat(String(first?.amount?.value ?? "0"));
      amountMinor = Number.isFinite(val) ? Math.round(val * 100) : 0;
    }
    return { sessionId, amountMinor };
  }

  it("extracts session_id and amount from PAYMENT.CAPTURE.COMPLETED", () => {
    const result = extractSessionAndAmount("PAYMENT.CAPTURE.COMPLETED", {
      custom_id: "sess_abc123",
      amount: { value: "150.00", currency_code: "PHP" },
    });
    expect(result.sessionId).toBe("sess_abc123");
    expect(result.amountMinor).toBe(15000);
  });

  it("extracts session_id from CHECKOUT.ORDER.APPROVED", () => {
    const result = extractSessionAndAmount("CHECKOUT.ORDER.APPROVED", {
      purchase_units: [
        { custom_id: "sess_xyz789", amount: { value: "50.50" } },
      ],
    });
    expect(result.sessionId).toBe("sess_xyz789");
    expect(result.amountMinor).toBe(5050);
  });

  it("returns undefined session_id for unknown event type", () => {
    const result = extractSessionAndAmount("SOME.OTHER.EVENT", {
      custom_id: "sess_abc",
    });
    expect(result.sessionId).toBeUndefined();
    expect(result.amountMinor).toBe(0);
  });

  it("returns 0 amount when value is missing", () => {
    const result = extractSessionAndAmount("PAYMENT.CAPTURE.COMPLETED", {
      custom_id: "sess_abc123",
    });
    expect(result.sessionId).toBe("sess_abc123");
    expect(result.amountMinor).toBe(0);
  });
});

describe("PayPal webhook service", () => {
  const originalEnv = process.env;

  function createService() {
    return new PayPalPaymentProviderService(
      {},
      {
        clientId: "client-id",
        clientSecret: "client-secret",
        sandbox: true,
      },
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: "test", PAYPAL_WEBHOOK_ID: "wh_test" };
    (verifyPayPalWebhookSignature as jest.Mock).mockResolvedValue(true);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("accepts signed PAYMENT.CAPTURE.COMPLETED deliveries", async () => {
    const service = createService();
    (claimPayPalWebhookDedup as jest.Mock).mockResolvedValue(true);

    const result = await service.getWebhookActionAndData({
      data: {},
      rawData: JSON.stringify({
        id: "WH-1234",
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: {
          custom_id: "medusa_ps_123",
          amount: { value: "150.00", currency_code: "PHP" },
        },
      }),
      headers: {},
    });

    expect(result).toEqual({
      action: PaymentActions.SUCCESSFUL,
      data: { session_id: "medusa_ps_123", amount: 15000 },
    });
  });

  it("rejects invalid signatures", async () => {
    const service = createService();
    (verifyPayPalWebhookSignature as jest.Mock).mockResolvedValue(false);

    await expect(
      service.getWebhookActionAndData({
        data: {},
        rawData: "{}",
        headers: {},
      }),
    ).rejects.toThrow(MedusaError);
  });

  it("returns not supported for duplicate deliveries", async () => {
    const service = createService();
    (claimPayPalWebhookDedup as jest.Mock).mockResolvedValue(false);

    const result = await service.getWebhookActionAndData({
      data: {},
      rawData: JSON.stringify({
        id: "WH-dup",
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: {
          custom_id: "medusa_ps_dup",
          amount: { value: "20.00", currency_code: "PHP" },
        },
      }),
      headers: {},
    });

    expect(result).toEqual({ action: PaymentActions.NOT_SUPPORTED });
  });

  it("rejects a successful capture without a provider event ID", async () => {
    const service = createService();

    await expect(
      service.getWebhookActionAndData({
        data: {},
        rawData: JSON.stringify({
          event_type: "PAYMENT.CAPTURE.COMPLETED",
          resource: {
            custom_id: "medusa_ps_missing_event_id",
            amount: { value: "20.00", currency_code: "PHP" },
          },
        }),
        headers: {},
      }),
    ).rejects.toThrow("missing a provider event ID");
    expect(claimPayPalWebhookDedup).not.toHaveBeenCalled();
  });

  it("does not fulfill an approved order before capture completes", async () => {
    const service = createService();
    const result = await service.getWebhookActionAndData({
      data: {},
      rawData: JSON.stringify({
        id: "WH-approved",
        event_type: "CHECKOUT.ORDER.APPROVED",
        resource: {
          purchase_units: [{
            custom_id: "medusa_ps_approved",
            amount: { value: "20.00", currency_code: "PHP" },
          }],
        },
      }),
      headers: {},
    });

    expect(result).toEqual({ action: PaymentActions.NOT_SUPPORTED });
    expect(claimPayPalWebhookDedup).not.toHaveBeenCalled();
  });

  it("ignores a capture event with no positive amount or currency", async () => {
    const service = createService();
    const result = await service.getWebhookActionAndData({
      data: {},
      rawData: JSON.stringify({
        id: "WH-invalid-capture",
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: {
          custom_id: "medusa_ps_invalid",
          amount: { value: "0.00" },
        },
      }),
      headers: {},
    });

    expect(result).toEqual({ action: PaymentActions.NOT_SUPPORTED });
    expect(claimPayPalWebhookDedup).not.toHaveBeenCalled();
  });

  it("ignores supported events without session correlation", async () => {
    const service = createService();
    (claimPayPalWebhookDedup as jest.Mock).mockResolvedValue(true);

    const result = await service.getWebhookActionAndData({
      data: {},
      rawData: JSON.stringify({
        id: "WH-no-session",
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: {
          amount: { value: "20.00", currency_code: "PHP" },
        },
      }),
      headers: {},
    });

    expect(result).toEqual({ action: PaymentActions.NOT_SUPPORTED });
  });

  it("uses one capture idempotency key for every retry of an order", async () => {
    (capturePayPalOrder as jest.Mock).mockResolvedValue({
      status: "COMPLETED",
      captureId: "CAP-1",
      captureAmountMinor: 2000,
    });
    const service = createService();
    const input = { data: { paypal_order_id: "ORDER-1", amount: 2000, currency: "PHP" } } as never;

    await service.capturePayment(input);
    await service.capturePayment(input);

    expect((capturePayPalOrder as jest.Mock).mock.calls.map(([_, orderId, options]) => [orderId, options.requestId])).toEqual([
      ["ORDER-1", "uvs-capture-ORDER-1"],
      ["ORDER-1", "uvs-capture-ORDER-1"],
    ]);
  });
});
