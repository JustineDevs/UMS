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
import crypto from "node:crypto";
import { buildPaymongoWebhookDedupId, claimPaymongoWebhookDedup } from "../../lib/paymongo-webhook-dedup";
import {
  createPaymongoCheckoutSession,
  createPaymongoRefund,
  getPaymongoCheckoutSession,
  getPaymongoLink,
  type PaymongoClientOptions,
} from "../../lib/paymongo-sdk-client";

export type PaymongoPaymentOptions = {
  secretKey: string;
  webhookSecret: string;
  successUrl?: string;
  cancelUrl?: string;
};

function parseSessionFromDescription(description: string): string | undefined {
  const prefix = "medusa_ps:";
  if (!description.startsWith(prefix)) {
    return undefined;
  }
  const id = description.slice(prefix.length).trim();
  return id.length > 0 ? id : undefined;
}

function defaultStorefrontBase(): string {
  return (
    process.env.STOREFRONT_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function parseSessionFromReferenceNumber(
  referenceNumber: string | undefined,
): string | undefined {
  return referenceNumber ? parseSessionFromDescription(referenceNumber) : undefined;
}

function verifyPaymongoSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  webhookSecret: string,
): boolean {
  if (!signatureHeader?.trim()) {
    return false;
  }
  const parts = signatureHeader.split(",");
  const kv: Record<string, string> = {};
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    kv[p.slice(0, eq).trim()] = p.slice(eq + 1);
  }
  const timestamp = kv.t ?? "";
  const sig = kv.v1 || kv.te || kv.li || "";
  if (!timestamp || !sig) {
    return false;
  }
  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(payload)
    .digest("hex");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(sig, "utf8");
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export default class PaymongoPaymentProviderService extends AbstractPaymentProvider<PaymongoPaymentOptions> {
  static identifier = "paymongo";

  protected readonly options_: PaymongoPaymentOptions;

  constructor(cradle: Record<string, unknown>, options: PaymongoPaymentOptions) {
    super(cradle, options);
    this.options_ = options;
  }

  static validateOptions(options: Record<string, unknown>): void {
    const secretKey = String(options.secretKey ?? "").trim();
    const webhookSecret = String(options.webhookSecret ?? "").trim();
    if (!secretKey || !webhookSecret) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'Paymongo payment provider: "secretKey" and "webhookSecret" are required.',
      );
    }
  }

  private get clientOptions(): PaymongoClientOptions {
    return { secretKey: this.options_.secretKey };
  }

  private successUrl(): string {
    return (
      this.options_.successUrl?.trim() ||
      process.env.PAYMONGO_SUCCESS_URL?.trim() ||
      `${defaultStorefrontBase()}/checkout/hosted-return?provider=paymongo&status=success`
    );
  }

  private cancelUrl(): string {
    return (
      this.options_.cancelUrl?.trim() ||
      process.env.PAYMONGO_CANCEL_URL?.trim() ||
      `${defaultStorefrontBase()}/checkout/hosted-return?provider=paymongo&status=cancel`
    );
  }

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentOutput> {
    const sessionId = input.data?.session_id;
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Paymongo initiatePayment: missing session_id on payment session data.",
      );
    }
    const amountMinor = Number(input.amount);
    if (!Number.isFinite(amountMinor) || amountMinor < 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Paymongo initiatePayment: invalid amount.",
      );
    }

    const currency = String(
      (input.context as { currency_code?: string } | undefined)?.currency_code ??
        "php",
    ).toLowerCase();

    try {
      const sessionRef = `medusa_ps:${sessionId}`;
      const { checkoutSessionId, checkoutUrl } = await createPaymongoCheckoutSession(
        this.clientOptions,
        {
          amountMinor,
          currency,
          description: "Storefront checkout",
          referenceNumber: sessionRef,
          successUrl: this.successUrl(),
          cancelUrl: this.cancelUrl(),
          paymentMethodTypes: ["gcash"],
        },
      );

      return {
        id: checkoutSessionId,
        status: PaymentSessionStatus.REQUIRES_MORE,
        data: {
          session_id: sessionId,
          paymongo_checkout_session_id: checkoutSessionId,
          checkout_url: checkoutUrl,
        },
      };
    } catch (err) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Paymongo create link failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput,
  ): Promise<AuthorizePaymentOutput> {
    try {
      const checkoutSessionId = input.data?.paymongo_checkout_session_id as
        | string
        | undefined;
      if (checkoutSessionId?.trim()) {
        const { paymentIntentStatus, amountMinor, paymentId } =
          await getPaymongoCheckoutSession(
            this.clientOptions,
            checkoutSessionId.trim(),
          );
        if (paymentIntentStatus !== "succeeded") {
          throw new MedusaError(
            MedusaError.Types.NOT_ALLOWED,
            `Paymongo checkout session is not paid yet (payment_intent_status=${paymentIntentStatus || "unknown"}).`,
          );
        }

        return {
          status: PaymentSessionStatus.AUTHORIZED,
          data: {
            ...((input.data as Record<string, unknown>) ?? {}),
            paymongo_checkout_session_id: checkoutSessionId.trim(),
            ...(paymentId?.trim()
              ? { paymongo_payment_id: paymentId.trim() }
              : {}),
            ...(typeof amountMinor === "number" && Number.isFinite(amountMinor)
              ? { captured_amount_minor: amountMinor }
              : {}),
          },
        };
      }

      const linkId = input.data?.paymongo_link_id as string | undefined;
      if (!linkId?.trim()) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Paymongo authorizePayment: missing paymongo checkout session id in session data.",
        );
      }
      const { status, amountMinor, paymentId } = await getPaymongoLink(
        this.clientOptions,
        linkId,
      );
      if (status !== "paid") {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Paymongo link is not paid yet (status=${status || "unknown"}).`,
        );
      }
      return {
        status: PaymentSessionStatus.AUTHORIZED,
        data: {
          ...((input.data as Record<string, unknown>) ?? {}),
          paymongo_link_id: linkId,
          ...(paymentId?.trim() ? { paymongo_payment_id: paymentId.trim() } : {}),
          ...(typeof amountMinor === "number" && Number.isFinite(amountMinor)
            ? { captured_amount_minor: amountMinor }
            : {}),
        },
      };
    } catch (err) {
      if (err instanceof MedusaError) throw err;
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Paymongo retrieve link failed: ${err instanceof Error ? err.message : String(err)}`,
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
    const checkoutSessionId = input.data?.paymongo_checkout_session_id as
      | string
      | undefined;
    if (checkoutSessionId?.trim()) {
      const session = await getPaymongoCheckoutSession(
        this.clientOptions,
        checkoutSessionId.trim(),
      );
      const base = (input.data as Record<string, unknown>) ?? {};
      if (session.paymentIntentStatus === "succeeded") {
        return { status: PaymentSessionStatus.AUTHORIZED, data: base };
      }
      if (session.status === "expired" || session.status === "cancelled") {
        return { status: PaymentSessionStatus.CANCELED, data: base };
      }
      return { status: PaymentSessionStatus.REQUIRES_MORE, data: base };
    }

    const linkId = input.data?.paymongo_link_id as string | undefined;
    if (!linkId?.trim()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Paymongo getPaymentStatus: missing paymongo checkout session id in session data.",
      );
    }
    const link = await getPaymongoLink(this.clientOptions, linkId.trim());
    const base = (input.data as Record<string, unknown>) ?? {};
    if (link.status === "paid") {
      return { status: PaymentSessionStatus.AUTHORIZED, data: base };
    }
    if (link.status === "cancelled" || link.status === "canceled") {
      return { status: PaymentSessionStatus.CANCELED, data: base };
    }
    return { status: PaymentSessionStatus.REQUIRES_MORE, data: base };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const payId = (input.data?.paymongo_payment_id as string | undefined)?.trim();
    if (!payId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Paymongo refundPayment: missing paymongo_payment_id on payment data.",
      );
    }
    const currency = String(input.data?.currency ?? "php").toLowerCase();
    const major =
      input.amount != null && Number.isFinite(Number(input.amount))
        ? Number(input.amount)
        : NaN;
    if (!Number.isFinite(major) || major <= 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Paymongo refundPayment: invalid refund amount.",
      );
    }
    const zeroDecimal = currency === "jpy";
    const amountMinor = zeroDecimal ? Math.round(major) : Math.round(major * 100);
    try {
      await createPaymongoRefund(
        this.clientOptions,
        payId,
        amountMinor,
        "requested_by_customer",
      );
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

    const signature =
      (payload.headers["paymongo-signature"] as string | undefined) ??
      (payload.headers["Paymongo-Signature"] as string | undefined);

    if (!verifyPaymongoSignature(raw, signature, this.options_.webhookSecret)) {
      console.error(
        "[payment-webhook] verification_failed provider=paymongo reason=invalid_signature",
      );
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Invalid Paymongo webhook signature.",
      );
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Invalid Paymongo webhook JSON.",
      );
    }

    const successPayload = this.paymongoWebhookSuccessPayload(body);
    const dedupId = buildPaymongoWebhookDedupId(body);
    if (dedupId) {
      const isFirst = await claimPaymongoWebhookDedup(dedupId);
      if (!isFirst) {
        return successPayload ?? { action: PaymentActions.NOT_SUPPORTED };
      }
    }

    if (!successPayload) {
      return { action: PaymentActions.NOT_SUPPORTED };
    }
    return successPayload;
  }

  private paymongoWebhookSuccessPayload(
    body: Record<string, unknown>,
  ): WebhookActionResult | null {
    const evt = body.data as
      | {
          attributes?: {
            type?: string;
            data?: {
              id?: string;
              attributes?: {
                description?: string;
                amount?: number;
                status?: string;
              };
              relationships?: {
                payments?: { data?: Array<{ id?: string }> };
              };
            };
          };
        }
      | undefined;

    const eventType = String(evt?.attributes?.type ?? "");
    if (
      eventType !== "link.payment.paid" &&
      eventType !== "checkout_session.payment.paid"
    ) {
      return null;
    }

    const node = evt?.attributes?.data;
    const attrs = node?.attributes;

    let sessionId: string | undefined;
    let amount: number | undefined;
    let paymongoPaymentId: string | undefined;

    if (eventType === "checkout_session.payment.paid") {
      sessionId =
        parseSessionFromReferenceNumber(
          (attrs as { reference_number?: string } | undefined)?.reference_number,
        ) ??
        parseSessionFromDescription(
          (attrs as { description?: string } | undefined)?.description,
        );
      const paymentIntent = (attrs as {
        payment_intent?: {
          id?: string;
          attributes?: {
            amount?: number;
            status?: string;
            payments?: Array<{ id?: string }>;
          };
        };
      } | undefined)?.payment_intent;
      const intentStatus =
        paymentIntent?.attributes?.status?.toLowerCase() ?? "";
      if (intentStatus !== "succeeded") {
        return null;
      }
      amount = paymentIntent?.attributes?.amount;
      paymongoPaymentId =
        paymentIntent?.attributes?.payments?.[0]?.id?.trim() || undefined;
    } else {
      const linkAttrs = attrs as
        | {
            description?: string;
            amount?: number;
            status?: string;
          }
        | undefined;
      sessionId = parseSessionFromDescription(linkAttrs?.description);
      const status = (linkAttrs?.status ?? "").toLowerCase();
      if (status !== "paid") {
        return null;
      }
      amount = linkAttrs?.amount;
      const relPay = node?.relationships?.payments?.data?.[0]?.id;
      paymongoPaymentId =
        typeof relPay === "string" && relPay.trim() ? relPay.trim() : undefined;
    }

    if (!sessionId) {
      return null;
    }

    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Paymongo webhook missing paid amount.",
      );
    }

    return {
      action: PaymentActions.SUCCESSFUL,
      data: {
        session_id: sessionId,
        amount: Math.max(0, Math.round(amount)),
        ...(paymongoPaymentId ? { paymongo_payment_id: paymongoPaymentId } : {}),
      },
    };
  }
}
