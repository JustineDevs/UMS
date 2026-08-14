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
import { CheckoutPaymentIntent } from "@paypal/paypal-server-sdk";
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
  capturePayPalAuthorization,
  createPayPalOrder,
  authorizePayPalOrder,
  capturePayPalOrder,
  getPayPalOrder,
  refundPayPalCapture,
  voidPayPalAuthorization,
  verifyPayPalWebhookSignature,
  type PayPalClientOptions,
} from "../../lib/paypal-sdk-client";
import {
  getNangoPaymentCredentials,
  nangoContextFrom,
  nangoPaymentProxyConfigured,
  nangoPaymentProviderConfigured,
} from "../../lib/nango-payment-credentials";

export type PayPalPaymentOptions = {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
  captureMode?: "automatic" | "manual";
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

  private async sdkOptionsFor(context: unknown): Promise<PayPalClientOptions> {
    const contextNango = nangoContextFrom(context);
    const nangoContext = {
      nango_connection_id: contextNango?.nango_connection_id ?? process.env.NANGO_PAYMENT_CONNECTION_ID?.trim(),
      nango_provider_config_key: contextNango?.nango_provider_config_key ?? process.env.NANGO_PAYMENT_PROVIDER_CONFIG_KEY?.trim(),
    };
    const credentials = nangoPaymentProxyConfigured(nangoContext)
      ? null
      : await getNangoPaymentCredentials(nangoContext);
    const clientId = [credentials?.client_id, credentials?.clientId]
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);
    const clientSecret = [credentials?.client_secret, credentials?.clientSecret]
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);
    return {
      clientId: clientId?.trim() || this.options_.clientId,
      clientSecret: clientSecret?.trim() || this.options_.clientSecret,
      sandbox: this.options_.sandbox,
      accessToken: typeof credentials?.access_token === "string" ? credentials.access_token.trim() : undefined,
      nangoApiKey: process.env.NANGO_API_KEY?.trim(),
      nangoConnectionId: nangoContext?.nango_connection_id,
      nangoProviderConfigKey: nangoContext?.nango_provider_config_key,
    };
  }

  private captureMode(input?: { data?: Record<string, unknown> }): "automatic" | "manual" {
    const value = input?.data?.capture_mode ?? this.options_.captureMode ?? process.env.PAYPAL_CAPTURE_MODE;
    return String(value ?? "automatic").toLowerCase() === "manual" ? "manual" : "automatic";
  }

  static validateOptions(options: Record<string, unknown>): void {
    const clientId = String(options.clientId ?? "").trim();
    const clientSecret = String(options.clientSecret ?? "").trim();
    if ((!clientId || !clientSecret) && !nangoPaymentProviderConfigured(["paypal", "paypal-sandbox"])) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'PayPal payment provider requires direct credentials or a configured Nango PayPal integration.',
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
        await this.sdkOptionsFor(input.context),
        {
          sessionId,
          amountMajor: value,
          currencyCode: currency,
          returnUrl,
          cancelUrl,
          intent: this.captureMode(input) === "manual"
            ? CheckoutPaymentIntent.Authorize
            : undefined,
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
      const mode = this.captureMode(input);
      const requestId = `uvs-auth-${orderId}-${Date.now()}`;
      const authorization = mode === "manual"
        ? await authorizePayPalOrder(await this.sdkOptionsFor(input.data), orderId, requestId)
        : null;
      const capture = mode === "automatic"
        ? await capturePayPalOrder(await this.sdkOptionsFor(input.data), orderId, { requestId })
        : null;
      const operationStatus = authorization?.status ?? capture?.status ?? "";
      if (operationStatus !== "COMPLETED") {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `PayPal order not completed after ${mode}: ${operationStatus}`,
        );
      }

      return {
        status: mode === "automatic" ? PaymentSessionStatus.CAPTURED : PaymentSessionStatus.AUTHORIZED,
        data: {
          ...((input.data as Record<string, unknown>) ?? {}),
          paypal_order_id: orderId,
          ...(authorization?.authorizationId
            ? { paypal_authorization_id: authorization.authorizationId }
            : {}),
          ...(capture?.captureId?.trim()
            ? { paypal_capture_id: capture.captureId.trim() }
            : {}),
          ...(capture?.captureAmountMinor != null && Number.isFinite(capture.captureAmountMinor)
            ? { captured_amount_minor: capture.captureAmountMinor }
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
    const data = (input.data as Record<string, unknown>) ?? {};
    const orderId = String(data.paypal_order_id ?? data.id ?? "").trim();
    if (!orderId) throw new MedusaError(MedusaError.Types.INVALID_DATA, "PayPal capturePayment: missing order id.");
    const currency = String(data.currency ?? "PHP").toUpperCase();
    const amount = Number(data.amount);
    const requestId = `uvs-capture-${orderId}-${Date.now()}`;
    const options = await this.sdkOptionsFor(input.data);
    const authorizationId = String(data.paypal_authorization_id ?? "").trim();
    const captureInput = {
      requestId,
      ...(Number.isFinite(amount) && amount > 0
        ? { amountMajor: minorToMajor(amount, currency), currencyCode: currency }
        : {}),
    };
    const result = authorizationId
      ? await capturePayPalAuthorization(options, authorizationId, captureInput)
      : await capturePayPalOrder(options, orderId, captureInput);
    if (result.status !== "COMPLETED") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `PayPal capture failed: ${result.status}`);
    return { data: { ...data, paypal_order_id: orderId, ...(result.captureId ? { paypal_capture_id: result.captureId } : {}), ...(result.captureAmountMinor != null ? { captured_amount_minor: result.captureAmountMinor } : {}) } };
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const data = (input.data as Record<string, unknown>) ?? {};
    const authorizationId = String(data.paypal_authorization_id ?? "").trim();
    if (!authorizationId) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "PayPal cancelPayment: no authorization to void.");
    await voidPayPalAuthorization(await this.sdkOptionsFor(input.data), authorizationId, `uvs-void-${authorizationId}-${Date.now()}`);
    return { data: { ...data, paypal_authorization_id: authorizationId, paypal_voided: true } };
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input as unknown as CancelPaymentInput) as Promise<DeletePaymentOutput>;
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
    const order = await getPayPalOrder(await this.sdkOptionsFor(input.data), orderId.trim());
    const st = (order.status ?? "").toUpperCase();
    const base = (input.data as Record<string, unknown>) ?? {};
    if (st === "COMPLETED") {
      return {
        status: base.paypal_capture_id ? PaymentSessionStatus.CAPTURED : PaymentSessionStatus.AUTHORIZED,
        data: base,
      };
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
      await refundPayPalCapture(await this.sdkOptionsFor(input.data), {
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
    const orderId = String(input.data?.paypal_order_id ?? input.data?.id ?? "").trim();
    if (!orderId) throw new MedusaError(MedusaError.Types.INVALID_DATA, "PayPal retrievePayment: missing order id.");
    const order = await getPayPalOrder(await this.sdkOptionsFor(input.data), orderId);
    return { data: { ...((input.data as Record<string, unknown>) ?? {}), paypal_order: order } };
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "PayPal payment metadata is immutable after checkout creation.");
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
        await this.sdkOptionsFor(payload.data),
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
