import { MedusaError, PaymentActions } from "@medusajs/framework/utils";

import XenditPaymentProviderService from "../service";
import {
  claimXenditWebhookDedup,
  buildXenditWebhookDedupId,
} from "../../../lib/xendit-webhook-dedup";

jest.mock("../../../lib/xendit-webhook-dedup", () => ({
  buildXenditWebhookDedupId: jest.fn((body: Record<string, unknown>) => {
    const data = body.data as Record<string, unknown> | undefined;
    const key = data?.id ?? data?.payment_request_id ?? data?.payment_id;
    return key ? `xendit:${String(body.event ?? body.type ?? "unknown")}:${key}` : null;
  }),
  claimXenditWebhookDedup: jest.fn(),
}));

describe("Xendit webhook contract", () => {
  function service() {
    return new XenditPaymentProviderService(
      {},
      { secretKey: "xk_test", webhookToken: "callback-secret" },
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (claimXenditWebhookDedup as jest.Mock).mockResolvedValue(true);
  });

  it("accepts a signed paid event and correlates the Medusa session", async () => {
    const result = await service().getWebhookActionAndData({
      data: {},
      rawData: JSON.stringify({
        event: "payment.paid",
        data: {
          id: "payment-1",
          reference_id: "medusa_ps:session-1",
          amount: 15500,
          currency: "PHP",
        },
      }),
      headers: { "x-callback-token": "callback-secret" },
    });

    expect(result).toEqual({
      action: PaymentActions.SUCCESSFUL,
      data: {
        session_id: "session-1",
        amount: 15500,
        xendit_payment_request_id: "payment-1",
      },
    });
    expect(claimXenditWebhookDedup).toHaveBeenCalledWith("xendit:payment.paid:payment-1");
  });

  it("rejects a missing or invalid callback token", async () => {
    await expect(
      service().getWebhookActionAndData({
        data: {},
        rawData: "{}",
        headers: { "x-callback-token": "wrong" },
      }),
    ).rejects.toThrow(MedusaError);
  });

  it("does not process duplicate deliveries", async () => {
    (claimXenditWebhookDedup as jest.Mock).mockResolvedValue(false);

    await expect(
      service().getWebhookActionAndData({
        data: {},
        rawData: JSON.stringify({
          event: "payment.paid",
          data: { id: "payment-dup", reference_id: "medusa_ps:session-dup", amount: 100 },
        }),
        headers: { "x-callback-token": "callback-secret" },
      }),
    ).resolves.toEqual({ action: PaymentActions.NOT_SUPPORTED });
  });

  it("maps failed and expired deliveries to canceled", async () => {
    await expect(
      service().getWebhookActionAndData({
        data: {},
        rawData: JSON.stringify({
          type: "payment.expired",
          data: { id: "payment-expired", reference_id: "medusa_ps:session-expired", amount: 100 },
        }),
        headers: { "x-callback-token": "callback-secret" },
      }),
    ).resolves.toMatchObject({
      action: PaymentActions.CANCELED,
      data: { session_id: "session-expired", amount: 100 },
    });
  });

  it("does not claim or fulfill a malformed paid event", async () => {
    const result = await service().getWebhookActionAndData({
      data: {},
      rawData: JSON.stringify({
        event: "payment.paid",
        data: {
          id: "payment-invalid",
          reference_id: "medusa_ps:session-invalid",
          amount: 0,
          currency: "PHP",
        },
      }),
      headers: { "x-callback-token": "callback-secret" },
    });

    expect(result).toEqual({ action: PaymentActions.NOT_SUPPORTED });
    expect(claimXenditWebhookDedup).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON and ignores uncorrelated events", async () => {
    await expect(
      service().getWebhookActionAndData({
        data: {},
        rawData: "not-json",
        headers: { "x-callback-token": "callback-secret" },
      }),
    ).rejects.toThrow(MedusaError);

    await expect(
      service().getWebhookActionAndData({
        data: {},
        rawData: JSON.stringify({ event: "payment.paid", data: { id: "uncorrelated" } }),
        headers: { "x-callback-token": "callback-secret" },
      }),
    ).resolves.toEqual({ action: PaymentActions.NOT_SUPPORTED });
  });

  it("keeps the dedup key stable for a provider event", () => {
    expect(buildXenditWebhookDedupId({
      event: "payment.paid",
      data: { payment_request_id: "request-1" },
    })).toBe("xendit:payment.paid:request-1");
  });
});
