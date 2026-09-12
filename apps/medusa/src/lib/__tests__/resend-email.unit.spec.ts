import { sendResendTransactionalEmail } from "../resend-email";

describe("Resend transactional email delivery", () => {
  afterEach(() => jest.restoreAllMocks());

  it("retries transient failures with the same idempotency key", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "temporary" }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "email_123" }), { status: 200 }));

    const result = await sendResendTransactionalEmail({
      apiKey: "re_test",
      from: "Store <orders@example.com>",
      to: "buyer@example.com",
      subject: "Order confirmed",
      html: "<p>Thanks</p>",
      idempotencyKey: "order-confirmation/order_123",
      retryDelayMs: 0,
    });

    expect(result).toEqual({ ok: true, id: "email_123" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({ "Idempotency-Key": "order-confirmation/order_123" }),
    }));
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({ "Idempotency-Key": "order-confirmation/order_123" }),
    }));
  });

  it("does not retry permanent provider errors", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ message: "invalid recipient" }), { status: 422 }));

    const result = await sendResendTransactionalEmail({
      apiKey: "re_test",
      from: "orders@example.com",
      to: "invalid",
      subject: "Order confirmed",
      html: "<p>Thanks</p>",
      retryDelayMs: 0,
    });

    expect(result).toEqual({ ok: false, message: "invalid recipient" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
