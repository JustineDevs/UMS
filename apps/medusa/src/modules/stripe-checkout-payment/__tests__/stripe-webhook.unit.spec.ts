import {
  MedusaError,
  PaymentActions,
} from "@medusajs/framework/utils";

import StripeCheckoutPaymentProviderService from "../service";
import { claimStripeWebhookDedup } from "../../../lib/stripe-webhook-dedup";

jest.mock("../../../lib/stripe-webhook-dedup", () => ({
  buildStripeWebhookDedupId: jest.fn((event: { id: string; type: string }) =>
    `stripe:${event.type}:${event.id}`,
  ),
  claimStripeWebhookDedup: jest.fn(),
}));

describe("Stripe webhook state transitions", () => {
  function createService() {
    const service = new StripeCheckoutPaymentProviderService(
      {},
      {
        apiKey: "sk_test_123",
        webhookSecret: "whsec_test_123",
      },
    );

    return service as StripeCheckoutPaymentProviderService & {
      stripe_: {
        webhooks: {
          constructEvent: jest.Mock;
        };
      };
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts a signed checkout.session.completed event and returns successful action", async () => {
    const service = createService();
    service.stripe_.webhooks.constructEvent = jest.fn().mockReturnValue({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { session_id: "medusa_ps_123" },
          amount_total: 15500,
        },
      },
    });
    (claimStripeWebhookDedup as jest.Mock).mockResolvedValue(true);

    const result = await service.getWebhookActionAndData({
      data: {},
      rawData: "{}",
      headers: { "stripe-signature": "sig_test" },
    });

    expect(result).toEqual({
      action: PaymentActions.SUCCESSFUL,
      data: { session_id: "medusa_ps_123", amount: 15500 },
    });
  });

  it("returns canceled action for expired checkout sessions", async () => {
    const service = createService();
    service.stripe_.webhooks.constructEvent = jest.fn().mockReturnValue({
      id: "evt_2",
      type: "checkout.session.expired",
      data: {
        object: {
          metadata: { session_id: "medusa_ps_456" },
          amount_total: 4200,
        },
      },
    });
    (claimStripeWebhookDedup as jest.Mock).mockResolvedValue(true);

    const result = await service.getWebhookActionAndData({
      data: {},
      rawData: "{}",
      headers: { "stripe-signature": "sig_test" },
    });

    expect(result).toEqual({
      action: PaymentActions.CANCELED,
      data: { session_id: "medusa_ps_456", amount: 4200 },
    });
  });

  it("rejects invalid signatures", async () => {
    const service = createService();
    service.stripe_.webhooks.constructEvent = jest.fn(() => {
      throw new Error("bad signature");
    });

    await expect(
      service.getWebhookActionAndData({
        data: {},
        rawData: "{}",
        headers: { "stripe-signature": "bad" },
      }),
    ).rejects.toThrow(MedusaError);
  });

  it("ignores duplicate deliveries", async () => {
    const service = createService();
    service.stripe_.webhooks.constructEvent = jest.fn().mockReturnValue({
      id: "evt_dup",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { session_id: "medusa_ps_dup" },
          amount_total: 9900,
        },
      },
    });
    (claimStripeWebhookDedup as jest.Mock).mockResolvedValue(false);

    const result = await service.getWebhookActionAndData({
      data: {},
      rawData: "{}",
      headers: { "stripe-signature": "sig_test" },
    });

    expect(result).toEqual({ action: PaymentActions.NOT_SUPPORTED });
  });

  it("ignores successful events without Medusa session correlation", async () => {
    const service = createService();
    service.stripe_.webhooks.constructEvent = jest.fn().mockReturnValue({
      id: "evt_missing",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: {},
          amount_total: 1234,
        },
      },
    });

    const result = await service.getWebhookActionAndData({
      data: {},
      rawData: "{}",
      headers: { "stripe-signature": "sig_test" },
    });

    expect(result).toEqual({ action: PaymentActions.NOT_SUPPORTED });
    expect(claimStripeWebhookDedup).not.toHaveBeenCalled();
  });
});
