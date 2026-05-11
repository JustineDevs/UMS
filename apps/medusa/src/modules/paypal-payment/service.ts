import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  CreateAccountHolderInput,
  CreateAccountHolderOutput,
  DeleteAccountHolderInput,
  DeleteAccountHolderOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrieveAccountHolderInput,
  RetrieveAccountHolderOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types";
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils";
import {
  buildPayPalWebhookDedupId,
  claimPayPalWebhookDedup,
} from "../../lib/paypal-webhook-dedup";
import {
  createPayPalOrder,
  capturePayPalOrder,
  getPayPalOrder,
  refundPayPalCapture,
  verifyPayPalWebhookSignature,
  type PayPalClientOptions,
} from "../../lib/paypal-sdk-client";

export type PayPalPaymentOptions = {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
};

function minorToMajor(amountMinor: number, currency: string): string {
  const decimals = currency.toLowerCase() === "jpy" ? 0 : 2;
  const major = amountMinor / 100;
  return major.toFixed(decimals);
}

export default class PayPalPaymentProviderService extends AbstractPaymentProvider<PayPalPaymentOptions> {
  static identifier = "paypal";

  protected readonly options_: PayPalPaymentOptions;

  constructor(cradle: Record<string, unknown>, options: PayPalPaymentOptions) {
    super(cradle, options);
    this.options_ = options;
  }

  private get sdkOptions(): PayPalClientOptions {
    return {
      clientId: this.options_.clientId,
      clientSecret: this.options_.clientSecret,
      sandbox: this.options_.sandbox,
    };
  }

  static validateOptions(options: Record<string, unknown>): void {
    const clientId = String(options.clientId ?? "").trim();
    const clientSecret = String(options.clientSecret ?? "").trim();
    if (!clientId || !clientSecret) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'PayPal payment provider: "clientId" and "clientSecret" are required.',
      );
    }
  }

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentOutput> {
    const sessionId = input.data?.session_id;
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "PayPal initiatePayment: missing session_id on payment session data.",
      );
    }
    const amountMinor = Number(input.amount);
    if (!Number.isFinite(amountMinor) || amountMinor < 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "PayPal initiatePayment: invalid amount.",
      );
    }

    const currency = String(
      (input.context as { currency_code?: string } | undefined)?.currency_code ??
        "php",
    ).toUpperCase();

    const storefrontOrigin =
      process.env.STOREFRONT_PUBLIC_URL?.trim() ||
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      "http://localhost:3000";
    const returnUrl =
      process.env.PAYPAL_RETURN_URL?.trim() ||
      `${storefrontOrigin.replace(/\/$/, "")}/checkout/hosted-return?provider=paypal&status=success`;
    const cancelUrl =
      process.env.PAYPAL_CANCEL_URL?.trim() ||
      `${storefrontOrigin.replace(/\/$/, "")}/checkout/hosted-return?provider=paypal&status=cancel`;

    const value = minorToMajor(amountMinor, currency);

    try {
      const { orderId, approvalUrl } = await createPayPalOrder(
        this.sdkOptions,
        {
          sessionId,
          amountMajor: value,
          currencyCode: currency,
          returnUrl,
          cancelUrl,
        },
      );

      return {
        id: orderId,
        status: PaymentSessionStatus.REQUIRES_MORE,
        data: {
          session_id: sessionId,
          paypal_order_id: orderId,
          approval_url: approvalUrl,
          checkout_url: approvalUrl,
        },
      };
    } catch (err) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `PayPal create order failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput,
  ): Promise<AuthorizePaymentOutput> {
    const orderId =
      (input.data?.paypal_order_id as string | undefined) ??
      (input.data?.id as string | undefined);
    if (!orderId || typeof orderId !== "string") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "PayPal authorizePayment: missing paypal_order_id in session data.",
      );
    }

    try {
      const { status, captureAmountMinor, captureId } = await capturePayPalOrder(
        this.sdkOptions,
        orderId,
      );
      if (status !== "COMPLETED") {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `PayPal order not completed after capture: ${status}`,
        );
      }

      return {
        status: PaymentSessionStatus.AUTHORIZED,
        data: {
          ...((input.data as Record<string, unknown>) ?? {}),
          paypal_order_id: orderId,
          ...(captureId?.trim() ? { paypal_capture_id: captureId.trim() } : {}),
          ...(captureAmountMinor != null && Number.isFinite(captureAmountMinor)
            ? { captured_amount_minor: captureAmountMinor }
            : {}),
        },
      };
    } catch (err) {
      if (err instanceof MedusaError) throw err;
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `PayPal capture failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return { data: input.data ?? {} };
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: input.data ?? {} };
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data ?? {} };
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const orderId =
      (input.data?.paypal_order_id as string | undefined) ??
      (input.data?.id as string | undefined);
    if (!orderId?.trim()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "PayPal getPaymentStatus: missing paypal_order_id in session data.",
      );
    }
    const order = await getPayPalOrder(this.sdkOptions, orderId.trim());
    const st = (order.status ?? "").toUpperCase();
    const base = (input.data as Record<string, unknown>) ?? {};
    if (st === "COMPLETED") {
      return { status: PaymentSessionStatus.AUTHORIZED, data: base };
    }
    if (st === "VOIDED" || st === "CANCELLED" || st === "CANCELED") {
      return { status: PaymentSessionStatus.CANCELED, data: base };
    }
    if (st === "APPROVED" || st === "PAYER_ACTION_REQUIRED") {
      return { status: PaymentSessionStatus.REQUIRES_MORE, data: base };
    }
    return { status: PaymentSessionStatus.PENDING, data: base };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const captureId = (input.data?.paypal_capture_id as string | undefined)?.trim();
    if (!captureId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "PayPal refundPayment: missing paypal_capture_id on payment data.",
      );
    }
    const currency = String(input.data?.currency ?? "PHP").toUpperCase();
    const decimals = currency === "JPY" ? 0 : 2;
    const major =
      input.amount != null && Number.isFinite(Number(input.amount))
        ? Number(input.amount).toFixed(decimals)
        : undefined;
    try {
      await refundPayPalCapture(this.sdkOptions, {
        captureId,
        currencyCode: currency,
        amountMajor: major,
      });
    } catch (err) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        err instanceof Error ? err.message : String(err),
      );
    }
    return { data: input.data ?? {} };
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return { data: input.data ?? {} };
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { data: input.data ?? {} };
  }

  async createAccountHolder(
    input: CreateAccountHolderInput,
  ): Promise<CreateAccountHolderOutput> {
    return { id: input.context.customer.id };
  }

  async retrieveAccountHolder(
    input: RetrieveAccountHolderInput,
  ): Promise<RetrieveAccountHolderOutput> {
    return { id: input.id };
  }

  async deleteAccountHolder(
    _input: DeleteAccountHolderInput,
  ): Promise<DeleteAccountHolderOutput> {
    return { data: {} };
  }

  async getWebhookActionAndData(
    payload: {
      data: Record<string, unknown>;
      rawData: string | Buffer;
      headers: Record<string, unknown>;
    },
  ): Promise<WebhookActionResult> {
    const raw =
      typeof payload.rawData === "string"
        ? payload.rawData
        : Buffer.isBuffer(payload.rawData)
          ? payload.rawData.toString("utf8")
          : JSON.stringify(payload.rawData);

    const allowUnverified =
      process.env.MEDUSA_ALLOW_UNVERIFIED_PAYPAL_WEBHOOKS === "true";
    const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
    if (!webhookId && !allowUnverified) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "PAYPAL_WEBHOOK_ID is required for PayPal webhooks (set MEDUSA_ALLOW_UNVERIFIED_PAYPAL_WEBHOOKS=true for local dev only).",
      );
    }
    if (webhookId) {
      const valid = await verifyPayPalWebhookSignature(
        this.sdkOptions,
        payload.headers,
        raw,
        webhookId,
      );
      if (!valid) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "PayPal webhook signature invalid.",
        );
      }
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Invalid PayPal webhook JSON.",
      );
    }

    const eventType = (body.event_type as string) ?? "";
    const captureEvents = [
      "PAYMENT.CAPTURE.COMPLETED",
      "CHECKOUT.ORDER.APPROVED",
    ];
    if (!captureEvents.includes(eventType)) {
      return { action: PaymentActions.NOT_SUPPORTED };
    }

    const dedupId = buildPayPalWebhookDedupId(body);
    if (dedupId) {
      const isFirst = await claimPayPalWebhookDedup(dedupId);
      if (!isFirst) {
        return { action: PaymentActions.NOT_SUPPORTED };
      }
    }

    const resource = body.resource as Record<string, unknown> | undefined;
    if (!resource) {
      return { action: PaymentActions.NOT_SUPPORTED };
    }

    let sessionId: string | undefined;
    let amountMinor = 0;
    let paypalCaptureId: string | undefined;

    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      sessionId = resource.custom_id as string | undefined;
      paypalCaptureId =
        typeof resource.id === "string" && resource.id.trim()
          ? resource.id.trim()
          : undefined;
      const amountObj = resource.amount as
        | { value?: string; currency_code?: string }
        | undefined;
      const val = parseFloat(String(amountObj?.value ?? "0"));
      amountMinor = Number.isFinite(val) ? Math.round(val * 100) : 0;
    } else if (eventType === "CHECKOUT.ORDER.APPROVED") {
      const units = resource.purchase_units as
        | Array<{
            custom_id?: string;
            amount?: { value?: string };
          }>
        | undefined;
      const first = units?.[0];
      sessionId = first?.custom_id;
      const val = parseFloat(String(first?.amount?.value ?? "0"));
      amountMinor = Number.isFinite(val) ? Math.round(val * 100) : 0;
    }

    if (!sessionId?.trim()) {
      return { action: PaymentActions.NOT_SUPPORTED };
    }

    return {
      action: PaymentActions.SUCCESSFUL,
      data: {
        session_id: sessionId,
        amount: Math.max(0, amountMinor),
        ...(paypalCaptureId ? { paypal_capture_id: paypalCaptureId } : {}),
      },
    };
  }
}
