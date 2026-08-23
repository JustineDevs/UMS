import crypto from "node:crypto";
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
  buildXenditWebhookDedupId,
  claimXenditWebhookDedup,
} from "../../lib/xendit-webhook-dedup";
import { recordWebhookSecurityEvent } from "../../lib/webhook-security-metrics";
import {
  createXenditPaymentSession,
  cancelXenditPayment,
  captureXenditPayment,
  getXenditPaymentSession,
  refundXenditPayment,
  type XenditClientOptions,
} from "../../lib/xendit-sdk-client";
import {
  getNangoPaymentCredentials,
  nangoContextFrom,
  nangoPaymentProviderConfigured,
} from "../../lib/nango-payment-credentials";

export type XenditPaymentOptions = {
  secretKey: string;
  webhookToken: string;
  successUrl?: string;
  cancelUrl?: string;
  sessionMode?: "PAYMENT_LINK" | "COMPONENTS";
  sessionType?: "PAY" | "SAVE" | "PAY_AND_SAVE" | "SUBSCRIPTION";
  allowedPaymentChannels?: string[];
  componentsOrigin?: string;
  allowSavePaymentMethod?: "DISABLED" | "OPTIONAL" | "FORCED";
  country?: string;
  captureMethod?: "AUTOMATIC" | "MANUAL";
};

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

function defaultStorefrontBase(): string {
  return (
    process.env.STOREFRONT_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function parseSessionId(referenceId: string | undefined): string | undefined {
  const prefix = "medusa_ps:";
  if (!referenceId?.startsWith(prefix)) return undefined;
  const id = referenceId.slice(prefix.length).trim();
  return id.length > 0 ? id : undefined;
}

function normalizeWebhookToken(raw: string | undefined): string {
  return raw?.trim() ?? "";
}

function verifyWebhookToken(
  headerToken: string | undefined,
  expectedToken: string,
): boolean {
  const provided = normalizeWebhookToken(headerToken);
  if (!provided || !expectedToken) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expectedToken));
  } catch {
    return false;
  }
}

export default class XenditPaymentProviderService extends AbstractPaymentProvider<XenditPaymentOptions> {
  static identifier = "xendit";

  protected readonly options_: XenditPaymentOptions;

  constructor(cradle: Record<string, unknown>, options: XenditPaymentOptions) {
    super(cradle, options);
    this.options_ = options;
  }

  static validateOptions(options: Record<string, unknown>): void {
    const secretKey = String(options.secretKey ?? "").trim();
    const webhookToken = String(options.webhookToken ?? "").trim();
    if ((!secretKey || !webhookToken) && !nangoPaymentProviderConfigured(["xendit", "xendit-sandbox"])) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'Xendit payment provider: "secretKey" and "webhookToken" are required.',
      );
    }
  }

  private get clientOptions(): XenditClientOptions {
    return { secretKey: this.options_.secretKey };
  }

  private async clientOptionsFor(context: unknown): Promise<XenditClientOptions> {
    const credentials = await getNangoPaymentCredentials(nangoContextFrom(context));
    const secretKey = [credentials?.secret_key, credentials?.api_key, credentials?.secretKey]
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);
    return { secretKey: secretKey?.trim() || this.options_.secretKey };
  }

  private successUrl(): string {
    return (
      process.env.XENDIT_CHECKOUT_SUCCESS_URL?.trim() ||
      this.options_.successUrl?.trim() ||
      `${defaultStorefrontBase()}/checkout/hosted-return?provider=xendit&status=success`
    );
  }

  private cancelUrl(): string {
    return (
      process.env.XENDIT_CHECKOUT_CANCEL_URL?.trim() ||
      this.options_.cancelUrl?.trim() ||
      `${defaultStorefrontBase()}/checkout/hosted-return?provider=xendit&status=cancel`
    );
  }

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentOutput> {
    const sessionId = input.data?.session_id;
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Xendit initiatePayment: missing session_id on payment session data.",
      );
    }
    const amountMinor = Number(input.amount);
    const configuredSessionType = this.options_.sessionType ?? (process.env.XENDIT_SESSION_TYPE as "PAY" | "SAVE" | "PAY_AND_SAVE" | "SUBSCRIPTION" | undefined);
    if (!Number.isFinite(amountMinor) || amountMinor < 0 || (configuredSessionType !== "SAVE" && amountMinor < 1)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Xendit initiatePayment: invalid amount.",
      );
    }
    const currency = String(
      (input.context as { currency_code?: string } | undefined)?.currency_code ??
        "PHP",
    ).toUpperCase();

    try {
      const session = await createXenditPaymentSession(await this.clientOptionsFor(input.context), {
        amountMinor,
        currency,
        description: "Storefront checkout",
        referenceId: `medusa_ps:${sessionId}`,
      successUrl: this.successUrl(),
      cancelUrl: this.cancelUrl(),
        mode: this.options_.sessionMode ?? (process.env.XENDIT_SESSION_MODE as "PAYMENT_LINK" | "COMPONENTS" | undefined),
        sessionType: configuredSessionType,
        allowedPaymentChannels: this.options_.allowedPaymentChannels,
        componentsOrigin: this.options_.componentsOrigin ?? process.env.XENDIT_COMPONENTS_ORIGIN,
        allowSavePaymentMethod: this.options_.allowSavePaymentMethod,
        country: this.options_.country ?? process.env.XENDIT_COUNTRY ?? "PH",
        captureMethod:
          this.options_.captureMethod ??
          (process.env.XENDIT_CAPTURE_METHOD as "AUTOMATIC" | "MANUAL" | undefined),
        idempotencyKey: `uvs-session-${sessionId}`,
        customer: (() => {
          const context = input.context as { customer?: { id?: string; email?: string; first_name?: string; last_name?: string } } | undefined;
          const customer = context?.customer;
          return customer?.id
            ? {
                referenceId: customer.id,
                email: customer.email,
                givenNames: customer.first_name,
                surname: customer.last_name,
              }
            : undefined;
        })(),
      });

      return {
        id: session.sessionId,
        status: PaymentSessionStatus.REQUIRES_MORE,
        data: {
          session_id: sessionId,
          xendit_session_id: session.sessionId,
          xendit_payment_request_id: session.paymentRequestId,
          xendit_payment_id: session.paymentId,
          checkout_url: session.checkoutUrl,
          payment_link_url: session.checkoutUrl,
          ...(session.componentsSdkKey ? { components_sdk_key: session.componentsSdkKey } : {}),
          ...(session.paymentTokenId ? { xendit_payment_token_id: session.paymentTokenId } : {}),
        },
      };
    } catch (err) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Xendit create session failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput,
  ): Promise<AuthorizePaymentOutput> {
    const sessionId =
      (input.data?.xendit_session_id as string | undefined)?.trim() ||
      (input.data?.id as string | undefined)?.trim();
    if (!sessionId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Xendit authorizePayment: missing xendit_session_id in session data.",
      );
    }

    try {
      const session = await getXenditPaymentSession(await this.clientOptionsFor(input.data), sessionId);
      const status = session.status.toLowerCase();
      if (
        status !== "completed" &&
        status !== "success" &&
        status !== "paid" &&
        status !== "authorized"
      ) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Xendit session is not paid yet (status=${status || "unknown"}).`,
        );
      }

      const base = (input.data as Record<string, unknown>) ?? {};
      const paymentRequestId =
        session.paymentRequestId ?? (input.data?.xendit_payment_request_id as string | undefined);
      const paymentId =
        session.paymentId ?? (input.data?.xendit_payment_id as string | undefined);
      return {
        status: PaymentSessionStatus.AUTHORIZED,
        data: {
          ...base,
          xendit_session_id: sessionId,
          ...(paymentRequestId ? { xendit_payment_request_id: paymentRequestId } : {}),
          ...(paymentId ? { xendit_payment_id: paymentId } : {}),
          ...(typeof session.amountMinor === "number" && Number.isFinite(session.amountMinor)
            ? status === "authorized"
              ? { authorized_amount_minor: session.amountMinor }
              : { captured_amount_minor: session.amountMinor }
            : {}),
          ...(session.referenceId ? { xendit_reference_id: session.referenceId } : {}),
        },
      };
    } catch (err) {
      if (err instanceof MedusaError) throw err;
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Xendit retrieve session failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const paymentId = (input.data?.xendit_payment_id as string | undefined)?.trim();
    if (!paymentId) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Xendit capturePayment requires a payment_id from an authorized payment.",
      );
    }
    const currency = String(input.data?.currency ?? "PHP").toUpperCase();
    const major = Number(input.data?.amount ?? input.data?.amount_major);
    const amountMinor = Number.isFinite(major)
      ? ZERO_DECIMAL_CURRENCIES.has(currency)
        ? Math.round(major)
        : Math.round(major * 100)
      : undefined;
    try {
      await captureXenditPayment(await this.clientOptionsFor(input.data), {
        paymentId,
        amountMinor,
        idempotencyKey: `uvs-capture-${paymentId}`,
      });
    } catch (err) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        err instanceof Error ? err.message : String(err),
      );
    }
    return { data: { ...(input.data ?? {}), xendit_payment_id: paymentId } };
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const paymentId = (input.data?.xendit_payment_id as string | undefined)?.trim();
    if (!paymentId) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Xendit cancelPayment requires a payment_id from an authorized payment.",
      );
    }
    try {
      await cancelXenditPayment(await this.clientOptionsFor(input.data), paymentId, `uvs-cancel-${paymentId}`);
    } catch (err) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        err instanceof Error ? err.message : String(err),
      );
    }
    return { data: { ...(input.data ?? {}), xendit_payment_id: paymentId } };
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>;
    const paymentId = (data.xendit_payment_id as string | undefined)?.trim();
    if (paymentId) {
      await cancelXenditPayment(await this.clientOptionsFor(data), paymentId, `uvs-delete-${paymentId}`);
      return { data: { ...data, xendit_payment_id: paymentId, provider_deleted: true } };
    }

    const sessionId = (data.xendit_session_id as string | undefined)?.trim();
    if (!sessionId) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Xendit deletePayment requires a payment or session identifier.",
      );
    }

    const session = await getXenditPaymentSession(await this.clientOptionsFor(data), sessionId);
    const status = session.status.toLowerCase();
    if (!["expired", "cancelled", "canceled", "failed"].includes(status)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Xendit session cannot be deleted while it is ${status || "active"}; cancel the provider payment first.`,
      );
    }
    return { data: { ...data, xendit_session_id: sessionId, provider_deleted: true } };
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput,
  ): Promise<GetPaymentStatusOutput> {
    const sessionId =
      (input.data?.xendit_session_id as string | undefined)?.trim() ||
      (input.data?.id as string | undefined)?.trim();
    if (!sessionId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Xendit getPaymentStatus: missing xendit_session_id in session data.",
      );
    }
    const session = await getXenditPaymentSession(await this.clientOptionsFor(input.data), sessionId);
    const status = session.status.toLowerCase();
    const base = (input.data as Record<string, unknown>) ?? {};
    if (status.includes("captured")) {
      return { status: PaymentSessionStatus.CAPTURED, data: base };
    }
    if (
      status === "completed" ||
      status === "success" ||
      status === "paid" ||
      status === "authorized"
    ) {
      return { status: PaymentSessionStatus.AUTHORIZED, data: base };
    }
    if (status === "expired" || status === "cancelled" || status === "canceled") {
      return { status: PaymentSessionStatus.CANCELED, data: base };
    }
    return { status: PaymentSessionStatus.REQUIRES_MORE, data: base };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const paymentRequestId =
      (input.data?.xendit_payment_request_id as string | undefined)?.trim() ||
      (input.data?.xendit_session_id as string | undefined)?.trim();
    if (!paymentRequestId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Xendit refundPayment: missing xendit_payment_request_id on payment data.",
      );
    }
    const currency = String(input.data?.currency ?? "PHP").toUpperCase();
    const major =
      input.amount != null && Number.isFinite(Number(input.amount))
        ? Number(input.amount)
        : NaN;
    if (!Number.isFinite(major) || major <= 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Xendit refundPayment: invalid refund amount.",
      );
    }
    const minor = ZERO_DECIMAL_CURRENCIES.has(currency)
      ? Math.round(major)
      : Math.round(major * 100);
    try {
      await refundXenditPayment(await this.clientOptionsFor(input.data), {
        paymentRequestId,
        amountMinor: minor,
        currency,
        idempotencyKey: `uvs-refund-${paymentRequestId}-${minor}`,
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
    const sessionId = String(input.data?.xendit_session_id ?? input.data?.id ?? "").trim();
    if (!sessionId) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Xendit retrievePayment: missing session id.");
    const session = await getXenditPaymentSession(await this.clientOptionsFor(input.data), sessionId);
    return { data: { ...((input.data as Record<string, unknown>) ?? {}), xendit_session: session } };
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Xendit payment metadata is immutable after session creation.");
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

  async getWebhookActionAndData(payload: {
    data: Record<string, unknown>;
    rawData: string | Buffer;
    headers: Record<string, unknown>;
  }): Promise<WebhookActionResult> {
    const raw =
      typeof payload.rawData === "string"
        ? payload.rawData
        : Buffer.isBuffer(payload.rawData)
          ? payload.rawData.toString("utf8")
          : JSON.stringify(payload.rawData);

    const tokenHeader =
      (payload.headers["x-callback-token"] as string | undefined) ??
      (payload.headers["X-Callback-Token"] as string | undefined);
    if (!verifyWebhookToken(tokenHeader, normalizeWebhookToken(this.options_.webhookToken))) {
      await recordWebhookSecurityEvent("xendit", "signature_failure");
      console.error(
        "[payment-webhook] verification_failed provider=xendit reason=invalid_callback_token",
      );
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Invalid Xendit webhook token.",
      );
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Invalid Xendit webhook JSON.",
      );
    }

    const success = this.xenditWebhookSuccessPayload(body);
    if (!success) return { action: PaymentActions.NOT_SUPPORTED };

    const dedupId = buildXenditWebhookDedupId(body);
    if (dedupId) {
      const isFirst = await claimXenditWebhookDedup(dedupId);
      if (!isFirst) {
        return { action: PaymentActions.NOT_SUPPORTED };
      }
    }

    return success;
  }

  private xenditWebhookSuccessPayload(
    body: Record<string, unknown>,
  ): WebhookActionResult | null {
    const event = String(body.event ?? body.type ?? "").toLowerCase();
    const data = (body.data ?? body) as Record<string, unknown>;
    const referenceId =
      (data.reference_id as string | undefined) ??
      (data.metadata as { reference_id?: string; session_id?: string } | undefined)
        ?.reference_id ??
      (data.metadata as { session_id?: string } | undefined)?.session_id ??
      (data.payment_request_reference_id as string | undefined);
    const sessionId = parseSessionId(referenceId);
    if (!sessionId) {
      return null;
    }

    const isCanceled =
      event.includes("cancel") || event.includes("expire") || event.includes("failed");
    const currency = String(data.currency ?? "").trim().toUpperCase();
    if (isCanceled) {
      return {
        action: PaymentActions.CANCELED,
        data: {
          session_id: sessionId,
          amount: Math.max(0, Number(data.amount ?? 0)),
        },
      };
    }

    if (
      !event.includes("paid") &&
      !event.includes("completed") &&
      !event.includes("success") &&
      !event.includes("capture") &&
      !event.includes("authorize")
    ) {
      return null;
    }

    const amountRaw = data.amount as number | string | undefined;
    const amountMinor = Number.isFinite(Number(amountRaw))
      ? Math.round(Number(amountRaw))
      : 0;
    if (amountMinor < 1 || !/^[A-Z]{3}$/.test(currency)) return null;
    const paymentRequestId =
      (data.payment_request_id as string | undefined)?.trim() ||
      (data.id as string | undefined)?.trim();
    const paymentId =
      (data.payment_id as string | undefined)?.trim() ||
      (data.payment_id_external as string | undefined)?.trim();

    return {
      action: PaymentActions.SUCCESSFUL,
      data: {
        session_id: sessionId,
        amount: Math.max(0, amountMinor),
        ...(paymentRequestId ? { xendit_payment_request_id: paymentRequestId } : {}),
        ...(paymentId ? { xendit_payment_id: paymentId } : {}),
      },
    };
  }
}
