import { PaymentSessionStatus } from "@medusajs/framework/utils";

import PayPalPaymentProviderService from "../service";
import { getPayPalOrder } from "../../../lib/paypal-sdk-client";

jest.mock("../../../lib/paypal-sdk-client", () => {
  const actual = jest.requireActual<typeof import("../../../lib/paypal-sdk-client")>(
    "../../../lib/paypal-sdk-client",
  );
  return {
    ...actual,
    getPayPalOrder: jest.fn(),
  };
});

describe("PayPal getPaymentStatus", () => {
  function svc() {
    return new PayPalPaymentProviderService(
      {},
      { clientId: "cid", clientSecret: "sec", sandbox: true },
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps COMPLETED order to AUTHORIZED", async () => {
    (getPayPalOrder as jest.Mock).mockResolvedValue({ status: "COMPLETED" });
    const r = await svc().getPaymentStatus({
      data: { paypal_order_id: "ord_1" },
    } as never);
    expect(r.status).toBe(PaymentSessionStatus.AUTHORIZED);
    expect(getPayPalOrder).toHaveBeenCalledWith(
      expect.objectContaining({ sandbox: true }),
      "ord_1",
    );
  });

  it("maps VOIDED to CANCELED", async () => {
    (getPayPalOrder as jest.Mock).mockResolvedValue({ status: "VOIDED" });
    const r = await svc().getPaymentStatus({
      data: { paypal_order_id: "ord_1" },
    } as never);
    expect(r.status).toBe(PaymentSessionStatus.CANCELED);
  });
});
