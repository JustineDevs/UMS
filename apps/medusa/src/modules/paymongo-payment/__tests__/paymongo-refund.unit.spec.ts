/* global jest, describe, it, expect, beforeEach */
import { MedusaError } from "@medusajs/framework/utils";

import PaymongoPaymentProviderService from "../service";
import { createPaymongoRefund } from "../../../lib/paymongo-sdk-client";

jest.mock("../../../lib/paymongo-sdk-client", () => {
  const actual = jest.requireActual<typeof import("../../../lib/paymongo-sdk-client")>(
    "../../../lib/paymongo-sdk-client",
  );
  return {
    ...actual,
    createPaymongoRefund: jest.fn(),
  };
});

describe("Paymongo refundPayment", () => {
  function svc() {
    return new PaymongoPaymentProviderService(
      {},
      { secretKey: "sk_test_123", webhookSecret: "whsec" },
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls createPaymongoRefund with payment id and minor amount", async () => {
    (createPaymongoRefund as jest.Mock).mockResolvedValue(undefined);
    await svc().refundPayment({
      amount: 50,
      data: { paymongo_payment_id: "pay_abc", currency: "php" },
    } as never);
    expect(createPaymongoRefund).toHaveBeenCalledWith(
      expect.objectContaining({ secretKey: "sk_test_123" }),
      "pay_abc",
      5000,
      "requested_by_customer",
    );
  });

  it("rejects missing payment id", async () => {
    await expect(
      svc().refundPayment({ amount: 1, data: { currency: "php" } } as never),
    ).rejects.toThrow(MedusaError);
    expect(createPaymongoRefund).not.toHaveBeenCalled();
  });
});
