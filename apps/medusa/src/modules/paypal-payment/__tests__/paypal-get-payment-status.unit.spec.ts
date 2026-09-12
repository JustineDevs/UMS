import { PaymentSessionStatus } from "@medusajs/framework/utils";

import PayPalPaymentProviderService from "../service";
import { capturePayPalOrder, getPayPalOrder } from "../../../lib/paypal-sdk-client";

jest.mock("../../../lib/paypal-sdk-client", () => {
  const actual = jest.requireActual<typeof import("../../../lib/paypal-sdk-client")>(
    "../../../lib/paypal-sdk-client",
  );
  return {
    ...actual,
    getPayPalOrder: jest.fn(),
    capturePayPalOrder: jest.fn(),
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

  it("adopts a browser-captured order without attempting a second capture", async () => {
    (getPayPalOrder as jest.Mock).mockResolvedValue({
      status: "COMPLETED",
      purchaseUnits: [{ payments: { captures: [{ id: "cap_1", amount: { value: "25.00" } }] } }],
    });
    const result = await svc().authorizePayment({
      data: { paypal_order_id: "ord_1" },
    } as never);
    expect(result.status).toBe(PaymentSessionStatus.CAPTURED);
    expect(result.data).toMatchObject({ paypal_order_id: "ord_1", paypal_capture_id: "cap_1", captured_amount_minor: 2500 });
    expect(capturePayPalOrder).not.toHaveBeenCalled();
  });

  it("does not recapture an already captured payment during workflow replay", async () => {
    const result = await svc().capturePayment({
      data: { paypal_order_id: "ord_1", paypal_capture_id: "cap_1", captured_amount_minor: 2500, amount: 2500 },
    } as never);
    expect(result.data).toMatchObject({ paypal_order_id: "ord_1", paypal_capture_id: "cap_1" });
    expect(capturePayPalOrder).not.toHaveBeenCalled();
  });
});
