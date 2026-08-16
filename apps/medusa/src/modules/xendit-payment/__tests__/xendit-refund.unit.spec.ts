import { MedusaError, PaymentSessionStatus } from "@medusajs/framework/utils";

import XenditPaymentProviderService from "../service";
import {
  cancelXenditPayment,
  createXenditPaymentSession,
  getXenditPaymentSession,
  refundXenditPayment,
} from "../../../lib/xendit-sdk-client";

jest.mock("../../../lib/xendit-sdk-client", () => {
  const actual = jest.requireActual<typeof import("../../../lib/xendit-sdk-client")>(
    "../../../lib/xendit-sdk-client",
  );
  return {
    ...actual,
    cancelXenditPayment: jest.fn(),
    getXenditPaymentSession: jest.fn(),
    refundXenditPayment: jest.fn(),
  };
});

describe("Xendit refundPayment", () => {
  function svc() {
    return new XenditPaymentProviderService(
      {},
      { secretKey: "xk_test", webhookToken: "wh_test" },
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("converts PHP refund amount to minor units", async () => {
    (refundXenditPayment as jest.Mock).mockResolvedValue(undefined);

    await svc().refundPayment({
      amount: 25.5,
      data: {
        xendit_payment_request_id: "pr_123",
        currency: "PHP",
      },
    } as never);

    expect(refundXenditPayment).toHaveBeenCalledWith(
      expect.objectContaining({ secretKey: "xk_test" }),
      expect.objectContaining({
        paymentRequestId: "pr_123",
        currency: "PHP",
        amountMinor: 2550,
      }),
    );
  });

  it("keeps zero-decimal refund amounts as-is", async () => {
    (refundXenditPayment as jest.Mock).mockResolvedValue(undefined);

    await svc().refundPayment({
      amount: 1250,
      data: {
        xendit_payment_request_id: "pr_456",
        currency: "JPY",
      },
    } as never);

    expect(refundXenditPayment).toHaveBeenCalledWith(
      expect.objectContaining({ secretKey: "xk_test" }),
      expect.objectContaining({
        paymentRequestId: "pr_456",
        currency: "JPY",
        amountMinor: 1250,
      }),
    );
  });

  it("rejects missing payment request id", async () => {
    await expect(
      svc().refundPayment({ amount: 1, data: { currency: "PHP" } } as never),
    ).rejects.toThrow(MedusaError);
    expect(refundXenditPayment).not.toHaveBeenCalled();
  });

  it("accepts an authorized manual-capture session without marking it captured", async () => {
    (getXenditPaymentSession as jest.Mock).mockResolvedValue({
      status: "authorized",
      amountMinor: 2550,
      paymentId: "pay_123",
      paymentRequestId: "pr_123",
      referenceId: "medusa_ps:ps_123",
    });

    const result = await svc().authorizePayment({
      data: { xendit_session_id: "xs_123" },
    } as never);

    expect(result.status).toBe(PaymentSessionStatus.AUTHORIZED);
    expect(result.data).toMatchObject({
      xendit_payment_id: "pay_123",
      xendit_payment_request_id: "pr_123",
      authorized_amount_minor: 2550,
    });
    expect(result.data).not.toHaveProperty("captured_amount_minor");
  });

  it("cancels an external payment when Medusa deletes its session", async () => {
    (cancelXenditPayment as jest.Mock).mockResolvedValue(undefined);

    const result = await svc().deletePayment({
      data: { xendit_payment_id: "pay_123" },
    } as never);

    expect(cancelXenditPayment).toHaveBeenCalledWith(
      expect.objectContaining({ secretKey: "xk_test" }),
      "pay_123",
      "uvs-delete-pay_123",
    );
    expect(result.data).toMatchObject({
      xendit_payment_id: "pay_123",
      provider_deleted: true,
    });
  });
});

describe("Xendit callback URL contract", () => {
  it("rejects non-HTTPS callbacks before making a provider request", async () => {
    await expect(
      createXenditPaymentSession(
        { secretKey: "xk_test" },
        {
          amountMinor: 100,
          currency: "PHP",
          description: "test",
          referenceId: "medusa_ps:test",
          successUrl: "http://localhost:3000/checkout/hosted-return",
          cancelUrl: "https://example.test/cancel",
        },
      ),
    ).rejects.toThrow("successUrl must be an absolute HTTPS URL");
  });
});
