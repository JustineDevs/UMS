/* global jest, describe, it, expect, beforeEach */
import { MedusaError, PaymentActions } from "@medusajs/framework/utils";

import PaymongoPaymentProviderService from "../service";
import { claimPaymongoWebhookDedup } from "../../../lib/paymongo-webhook-dedup";

jest.mock("../../../lib/paymongo-webhook-dedup", () => ({
  buildPaymongoWebhookDedupId: jest.fn(() => "paymongo:event_1"),
  claimPaymongoWebhookDedup: jest.fn(),
}));

function sign(raw: string, secret: string): string {
  const timestamp = "1712345678";
  const digest = require("node:crypto")
    .createHmac("sha256", secret)
    .update(`${timestamp}.${raw}`)
    .digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

describe("Paymongo webhook service", () => {
  function createService() {
    return new PaymongoPaymentProviderService(
      {},
      {
        secretKey: "sk_test_123",
        webhookSecret: "whsec_paymongo_test",
      },
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts signed paid link events with Medusa session correlation", async () => {
    const service = createService();
    const raw = JSON.stringify({
      data: {
        attributes: {
          type: "link.payment.paid",
          data: {
            attributes: {
              description: "medusa_ps:medusa_ps_123",
              amount: 15500,
              status: "paid",
            },
          },
        },
      },
    });
    (claimPaymongoWebhookDedup as jest.Mock).mockResolvedValue(true);

    const result = await service.getWebhookActionAndData({
      data: {},
      rawData: raw,
      headers: { "paymongo-signature": sign(raw, "whsec_paymongo_test") },
    });

    expect(result).toEqual({
      action: PaymentActions.SUCCESSFUL,
      data: { session_id: "medusa_ps_123", amount: 15500 },
    });
  });

  it("accepts signed paid checkout session events with Medusa session correlation", async () => {
    const service = createService();
    const raw = JSON.stringify({
      data: {
        attributes: {
          type: "checkout_session.payment.paid",
          data: {
            attributes: {
              reference_number: "medusa_ps:medusa_ps_cs_123",
              payment_intent: {
                id: "pi_123",
                attributes: {
                  amount: 15500,
                  status: "succeeded",
                  payments: [{ id: "pay_123" }],
                },
              },
            },
          },
        },
      },
    });
    (claimPaymongoWebhookDedup as jest.Mock).mockResolvedValue(true);

    const result = await service.getWebhookActionAndData({
      data: {},
      rawData: raw,
      headers: { "paymongo-signature": sign(raw, "whsec_paymongo_test") },
    });

    expect(result).toEqual({
      action: PaymentActions.SUCCESSFUL,
      data: {
        session_id: "medusa_ps_cs_123",
        amount: 15500,
        paymongo_payment_id: "pay_123",
      },
    });
  });

  it("rejects invalid signatures", async () => {
    const service = createService();

    await expect(
      service.getWebhookActionAndData({
        data: {},
        rawData: "{}",
        headers: { "paymongo-signature": "bad" },
      }),
    ).rejects.toThrow(MedusaError);
  });

  it("returns the same success shape for duplicate deliveries", async () => {
    const service = createService();
    const raw = JSON.stringify({
      data: {
        attributes: {
          type: "link.payment.paid",
          data: {
            attributes: {
              description: "medusa_ps:medusa_ps_dup",
              amount: 4200,
              status: "paid",
            },
          },
        },
      },
    });
    (claimPaymongoWebhookDedup as jest.Mock).mockResolvedValue(false);

    const result = await service.getWebhookActionAndData({
      data: {},
      rawData: raw,
      headers: { "paymongo-signature": sign(raw, "whsec_paymongo_test") },
    });

    expect(result).toEqual({
      action: PaymentActions.SUCCESSFUL,
      data: { session_id: "medusa_ps_dup", amount: 4200 },
    });
  });

  it("throws when a paid link webhook omits amount", async () => {
    const service = createService();
    const raw = JSON.stringify({
      data: {
        attributes: {
          type: "link.payment.paid",
          data: {
            attributes: {
              description: "medusa_ps:medusa_ps_123",
              status: "paid",
            },
          },
        },
      },
    });
    (claimPaymongoWebhookDedup as jest.Mock).mockResolvedValue(true);

    await expect(
      service.getWebhookActionAndData({
        data: {},
        rawData: raw,
        headers: { "paymongo-signature": sign(raw, "whsec_paymongo_test") },
      }),
    ).rejects.toThrow("Paymongo webhook missing paid amount.");
  });
});
