import { MedusaError } from "@medusajs/framework/utils";

import PayPalPaymentProviderService from "../service";
import { refundPayPalCapture } from "../../../lib/paypal-sdk-client";

jest.mock("../../../lib/paypal-sdk-client", () => {
  const actual = jest.requireActual<typeof import("../../../lib/paypal-sdk-client")>(
    "../../../lib/paypal-sdk-client",
  );
  return {
    ...actual,
    refundPayPalCapture: jest.fn(),
  };
});

describe("PayPal refundPayment", () => {
  function svc() {
    return new PayPalPaymentProviderService(
      {},
      { clientId: "cid", clientSecret: "sec", sandbox: true },
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls refundPayPalCapture with capture id", async () => {
    (refundPayPalCapture as jest.Mock).mockResolvedValue(undefined);
    await svc().refundPayment({
      amount: 25.5,
      data: { paypal_capture_id: "CAP123", currency: "PHP" },
    } as never);
    expect(refundPayPalCapture).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "cid", sandbox: true }),
      expect.objectContaining({
        captureId: "CAP123",
        currencyCode: "PHP",
        amountMajor: "25.50",
      }),
    );
  });

  it("rejects missing capture id", async () => {
    await expect(
      svc().refundPayment({ amount: 1, data: { currency: "PHP" } } as never),
    ).rejects.toThrow(MedusaError);
    expect(refundPayPalCapture).not.toHaveBeenCalled();
  });

  it("does not expose provider error details to the client", async () => {
    (refundPayPalCapture as jest.Mock).mockRejectedValue(
      new Error("PayPal request id=secret_internal_detail"),
    );

    await expect(
      svc().refundPayment({
        amount: 1,
        data: { paypal_capture_id: "CAP123", currency: "PHP" },
      } as never),
    ).rejects.toThrow("PayPal refund failed. Try again or choose another payment method.");
    await expect(
      svc().refundPayment({
        amount: 1,
        data: { paypal_capture_id: "CAP123", currency: "PHP" },
      } as never),
    ).rejects.not.toThrow("secret_internal_detail");
  });
});
