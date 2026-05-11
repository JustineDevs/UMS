import { MedusaError } from "@medusajs/framework/utils";

import MayaPaymentProviderService from "../service";
import { refundMayaP3Payment } from "../../../lib/maya-sdk-client";

jest.mock("../../../lib/maya-sdk-client", () => {
  const actual = jest.requireActual<typeof import("../../../lib/maya-sdk-client")>(
    "../../../lib/maya-sdk-client",
  );
  return {
    ...actual,
    refundMayaP3Payment: jest.fn(),
  };
});

describe("Maya refundPayment", () => {
  function svc() {
    return new MayaPaymentProviderService(
      {},
      { secretKey: "sk_test", webhookSecret: "whsec", sandbox: true },
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls refundMayaP3Payment with transaction ref and amount", async () => {
    (refundMayaP3Payment as jest.Mock).mockResolvedValue(undefined);
    await svc().refundPayment({
      amount: 10.5,
      data: { maya_p3_transaction_ref: "CHK_REF", currency: "PHP" },
    } as never);
    expect(refundMayaP3Payment).toHaveBeenCalledWith(
      expect.objectContaining({ secretKey: "sk_test", sandbox: true }),
      expect.objectContaining({
        transactionReferenceNo: "CHK_REF",
        amountValue: 10.5,
        currency: "PHP",
        reason: "Order refund",
      }),
    );
  });

  it("rejects missing transaction reference", async () => {
    await expect(
      svc().refundPayment({ amount: 1, data: { currency: "PHP" } } as never),
    ).rejects.toThrow(MedusaError);
    expect(refundMayaP3Payment).not.toHaveBeenCalled();
  });
});
