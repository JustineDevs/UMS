/* global jest, describe, it, expect, beforeEach */
import { PaymentSessionStatus } from "@medusajs/framework/utils";

import PaymongoPaymentProviderService from "../service";
import { getPaymongoCheckoutSession } from "../../../lib/paymongo-sdk-client";
import { getPaymongoLink } from "../../../lib/paymongo-sdk-client";

jest.mock("../../../lib/paymongo-sdk-client", () => {
  const actual = jest.requireActual<typeof import("../../../lib/paymongo-sdk-client")>(
    "../../../lib/paymongo-sdk-client",
  );
  return {
    ...actual,
    getPaymongoCheckoutSession: jest.fn(),
    getPaymongoLink: jest.fn(),
  };
});

describe("Paymongo getPaymentStatus", () => {
  function svc() {
    return new PaymongoPaymentProviderService(
      {},
      { secretKey: "sk_test", webhookSecret: "whsec" },
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps succeeded checkout session to AUTHORIZED", async () => {
    (getPaymongoCheckoutSession as jest.Mock).mockResolvedValue({
      status: "active",
      paymentIntentStatus: "succeeded",
      amountMinor: 5000,
    });
    const r = await svc().getPaymentStatus({
      data: { paymongo_checkout_session_id: "cs_1" },
    } as never);
    expect(r.status).toBe(PaymentSessionStatus.AUTHORIZED);
    expect(getPaymongoCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ secretKey: "sk_test" }),
      "cs_1",
    );
  });

  it("maps paid link to AUTHORIZED", async () => {
    (getPaymongoLink as jest.Mock).mockResolvedValue({
      status: "paid",
      amountMinor: 5000,
    });
    const r = await svc().getPaymentStatus({
      data: { paymongo_link_id: "link_1" },
    } as never);
    expect(r.status).toBe(PaymentSessionStatus.AUTHORIZED);
    expect(getPaymongoLink).toHaveBeenCalledWith(
      expect.objectContaining({ secretKey: "sk_test" }),
      "link_1",
    );
  });

  it("maps cancelled to CANCELED", async () => {
    (getPaymongoLink as jest.Mock).mockResolvedValue({ status: "cancelled" });
    const r = await svc().getPaymentStatus({
      data: { paymongo_link_id: "link_1" },
    } as never);
    expect(r.status).toBe(PaymentSessionStatus.CANCELED);
  });
});
