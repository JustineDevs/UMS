import { PaymentSessionStatus } from "@medusajs/framework/utils";

import MayaPaymentProviderService from "../service";
import { getMayaInvoice } from "../../../lib/maya-sdk-client";

jest.mock("../../../lib/maya-sdk-client", () => {
  const actual = jest.requireActual<typeof import("../../../lib/maya-sdk-client")>(
    "../../../lib/maya-sdk-client",
  );
  return {
    ...actual,
    getMayaInvoice: jest.fn(),
  };
});

describe("Maya getPaymentStatus", () => {
  function svc() {
    return new MayaPaymentProviderService(
      {},
      { secretKey: "sk", webhookSecret: "wh", sandbox: true },
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps COMPLETED invoice to AUTHORIZED", async () => {
    (getMayaInvoice as jest.Mock).mockResolvedValue({
      status: "COMPLETED",
      amountMinor: 10000,
    });
    const r = await svc().getPaymentStatus({
      data: { maya_invoice_id: "inv_1" },
    } as never);
    expect(r.status).toBe(PaymentSessionStatus.AUTHORIZED);
    expect(getMayaInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ sandbox: true }),
      "inv_1",
    );
  });

  it("maps EXPIRED to CANCELED", async () => {
    (getMayaInvoice as jest.Mock).mockResolvedValue({ status: "EXPIRED" });
    const r = await svc().getPaymentStatus({
      data: { maya_invoice_id: "inv_1" },
    } as never);
    expect(r.status).toBe(PaymentSessionStatus.CANCELED);
  });
});
