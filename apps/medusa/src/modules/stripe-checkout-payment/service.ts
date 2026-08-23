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
import Stripe from "stripe";
import {
  getNangoPaymentCredentials,
  nangoContextFrom,
  nangoPaymentProviderConfigured,
} from "../../lib/nango-payment-credentials";
import {
  buildStripeWebhookDedupId,
  claimStripeWebhookDedup,
} from "../../lib/stripe-webhook-dedup";
import { recordWebhookSecurityEvent } from "../../lib/webhook-security-metrics";

export type StripeCheckoutPaymentOptions = {
  apiKey: string;
  webhookSecret: string;
  /** Must include the literal `{CHECKOUT_SESSION_ID}` so Stripe can substitute it. */
  successUrl?: string;
  cancelUrl?: string;
};

const ZERO_DECIMAL = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

/** Checkout Session `amount_total` is always in the smallest currency unit (same convention as PayPal and other webhook `amount` fields). */
function sessionAmountMinor(amountTotal: number | null | undefined): number {
  if (amountTotal == null || !Number.isFinite(amountTotal)) {
    return 0;
  }
  return Math.max(0, Math.round(amountTotal));
}

function defaultStorefrontBase(): string {
  return (
    process.env.STOREFRONT_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export default class StripeCheckoutPaymentProviderService extends AbstractPaymentProvider<StripeCheckoutPaymentOptions> {
  static identifier = "stripe";

  protected readonly options_: StripeCheckoutPaymentOptions;
  protected readonly stripe_: Stripe;

  constructor(cradle: Record<string, unknown>, options: StripeCheckoutPaymentOptions) {
    super(cradle, options);
    this.options_ = options;
    this.stripe_ = new Stripe(options.apiKey?.trim() || "sk_test_nango_managed", {
      typescript: true,
    });
  }

  static validateOptions(options: Record<string, unknown>): void {
    const apiKey = String(options.apiKey ?? "").trim();
    const webhookSecret = String(options.webhookSecret ?? "").trim();
    if ((!apiKey && !nangoPaymentProviderConfigured("stripe")) || !webhookSecret) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'Stripe payment provider requires a direct apiKey or configured Nango Stripe integration, plus webhookSecret.',
      );
    }
  }

  private successUrl(): string {
    const configured = this.options_.successUrl?.trim() || process.env.STRIPE_CHECKOUT_SUCCESS_URL?.trim();
    if (configured?.includes("{CHECKOUT_SESSION_ID}")) {
      return configured;
    }
    return `${defaultStorefrontBase()}/checkout/hosted-return?provider=stripe&status=success&stripe_session={CHECKOUT_SESSION_ID}`;
  }

  private cancelUrl(): string {
    return (
      this.options_.cancelUrl?.trim() ||
      process.env.STRIPE_CHECKOUT_CANCEL_URL?.trim() ||
      `${defaultStorefrontBase()}/checkout/hosted-return?provider=stripe&status=cancel`
    );
  }

  private async stripeClient(context: unknown): Promise<Stripe> {
    const credentials = await getNangoPaymentCredentials(nangoContextFrom(context));
    const accessToken = typeof credentials?.access_token === "string" ? credentials.access_token.trim() : "";
    if (accessToken) return new Stripe(accessToken, { typescript: true });
    if (this.options_.apiKey?.trim()) return this.stripe_;
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Stripe payment provider requires a connected Nango merchant account.",
    );
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const sessionId = input.data?.session_id;
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Stripe initiatePayment: missing session_id on payment session data.",
      );
    }

    const amountMinor = Number(input.amount);
    if (!Number.isFinite(amountMinor) || amountMinor < 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Stripe initiatePayment: invalid amount.",
      );
    }

    const ctxCurrency = (
      input.context as { currency_code?: string } | undefined
    )?.currency_code?.trim().toLowerCase() ||
      (input.data as { currency_code?: string } | undefined)?.currency_code?.trim().toLowerCase();
    const envFallback = process.env.STRIPE_CHECKOUT_FALLBACK_CURRENCY?.trim().toLowerCase();
    const currency =
      ctxCurrency && ctxCurrency.length === 3
        ? ctxCurrency
        : envFallback && envFallback.length === 3
          ? envFallback
          : null;
    if (!currency) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'Stripe initiatePayment: missing currency_code on payment context. Set the cart region currency in Medusa or STRIPE_CHECKOUT_FALLBACK_CURRENCY (e.g. "php"). Defaulting to "usd" caused wrong Checkout amounts when the cart was PHP.',
      );
    }

    const idempotencyKey =
      typeof (input.context as { idempotency_key?: string } | undefined)?.idempotency_key ===
      "string"
        ? (input.context as { idempotency_key: string }).idempotency_key
        : undefined;

    try {
      const stripe = await this.stripeClient(input.context);
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          success_url: this.successUrl(),
          cancel_url: this.cancelUrl(),
          client_reference_id: sessionId,
          metadata: {
            session_id: sessionId,
            amount_minor: String(Math.round(amountMinor)),
            currency,
          },
          payment_intent_data: {
            metadata: {
              session_id: sessionId,
              amount_minor: String(Math.round(amountMinor)),
              currency,
            },
          },
          adaptive_pricing: { enabled: false },
          line_items: [
            {
              price_data: {
                currency,
                product_data: {
                  name: "Order total",
                },
                unit_amount: Math.round(amountMinor),
              },
              quantity: 1,
            },
          ],
        } as Stripe.Checkout.SessionCreateParams,
        idempotencyKey ? { idempotencyKey } : undefined,
      );

      const url = session.url;
      if (!url?.startsWith("https://")) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Stripe initiatePayment: Checkout Session did not return a hosted URL.",
        );
      }

      return {
        id: session.id,
        status: PaymentSessionStatus.REQUIRES_MORE,
        data: {
          session_id: sessionId,
          stripe_checkout_session_id: session.id,
          checkout_url: url,
          approval_url: url,
        },
      };
    } catch (err) {
      if (err instanceof MedusaError) throw err;
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Stripe create Checkout Session failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const csId = input.data?.stripe_checkout_session_id as string | undefined;
    if (!csId?.trim()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Stripe authorizePayment: missing stripe_checkout_session_id in session data.",
      );
    }

    try {
      const stripe = await this.stripeClient(input.data);
      const checkoutSession = await stripe.checkout.sessions.retrieve(csId);
      if (checkoutSession.payment_status !== "paid") {
        console.error(
          "[payment-pipeline] authorize_failed provider=stripe reason=session_not_paid status=",
          checkoutSession.payment_status,
        );
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Stripe Checkout session is not paid yet (status=${checkoutSession.payment_status}).`,
        );
      }

      const pi = checkoutSession.payment_intent;
      const paymentIntentId = typeof pi === "string" ? pi : pi?.id;
      if (!paymentIntentId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Stripe authorizePayment: session has no payment intent.",
        );
      }

      const capturedMinor = sessionAmountMinor(checkoutSession.amount_total);

      return {
        status: PaymentSessionStatus.AUTHORIZED,
        data: {
          ...((input.data as Record<string, unknown>) ?? {}),
          id: paymentIntentId,
          stripe_checkout_session_id: csId,
          ...(capturedMinor > 0 ? { captured_amount_minor: capturedMinor } : {}),
        },
      };
    } catch (err) {
      if (err instanceof MedusaError) throw err;
      console.error(
        "[payment-pipeline] authorize_failed provider=stripe reason=retrieve_session",
        err,
      );
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Stripe retrieve Checkout Session failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const id = input.data?.id as string | undefined;
    if (!id?.trim()) {
      return { data: input.data ?? {} };
    }
    try {
      const stripe = await this.stripeClient(input.data);
      const intent = await stripe.paymentIntents.retrieve(id);
      if (intent.status === "succeeded") {
        return { data: { ...((input.data as Record<string, unknown>) ?? {}), id } };
      }
      if (intent.status === "requires_capture") {
        const captured = await stripe.paymentIntents.capture(id);
        return { data: { ...((input.data as Record<string, unknown>) ?? {}), id: captured.id } };
      }
    } catch {
      /* fall through */
    }
    return { data: input.data ?? {} };
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const stripe = await this.stripeClient(input.data);
    const csId = input.data?.stripe_checkout_session_id as string | undefined;
    if (csId?.trim()) {
      try {
        await stripe.checkout.sessions.expire(csId);
      } catch {
        /* session may already be completed or expired */
      }
    }
    const piId = input.data?.id as string | undefined;
    if (piId?.trim()) {
      try {
        await stripe.paymentIntents.cancel(piId);
      } catch {
        /* ignore */
      }
    }
    return { data: input.data ?? {} };
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input);
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const id = input.data?.id as string | undefined;
    if (!id?.trim()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Stripe getPaymentStatus: missing payment intent id.",
      );
    }
    const stripe = await this.stripeClient(input.data);
    const intent = await stripe.paymentIntents.retrieve(id);
    switch (intent.status) {
      case "succeeded":
        return { status: PaymentSessionStatus.CAPTURED, data: intent as unknown as Record<string, unknown> };
      case "canceled":
        return { status: PaymentSessionStatus.CANCELED, data: intent as unknown as Record<string, unknown> };
      case "requires_payment_method":
      case "requires_confirmation":
      case "requires_action":
      case "processing":
        return { status: PaymentSessionStatus.REQUIRES_MORE, data: intent as unknown as Record<string, unknown> };
      default:
        return { status: PaymentSessionStatus.PENDING, data: intent as unknown as Record<string, unknown> };
    }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const id = input.data?.id as string | undefined;
    if (!id?.trim()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Stripe refundPayment: missing payment intent id.",
      );
    }
    const currency = String(input.data?.currency ?? "usd").toLowerCase();
    const major = input.amount != null ? Number(input.amount) : undefined;
    const refundMinor =
      major != null && Number.isFinite(major)
        ? ZERO_DECIMAL.has(currency)
          ? Math.round(major)
          : Math.round(major * 100)
        : undefined;
    const stripe = await this.stripeClient(input.data);
    await stripe.refunds.create({
      payment_intent: id,
      ...(refundMinor != null ? { amount: refundMinor } : {}),
    });
    return { data: input.data ?? {} };
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const id = input.data?.id as string | undefined;
    if (!id?.trim()) {
      return { data: input.data ?? {} };
    }
    const stripe = await this.stripeClient(input.data);
    const intent = await stripe.paymentIntents.retrieve(id);
    return { data: intent as unknown as Record<string, unknown> };
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const id = String(input.data?.id ?? "").trim();
    if (!id) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Stripe updatePayment: missing payment intent id.");
    const metadata = input.data?.metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Stripe updatePayment: metadata is required.");
    }
    const stripe = await this.stripeClient(input.data);
    const intent = await stripe.paymentIntents.update(id, { metadata: metadata as Record<string, string> });
    return { data: intent as unknown as Record<string, unknown> };
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
    const signature = payload.headers["stripe-signature"] as string | undefined;
    if (!signature?.trim()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Missing Stripe-Signature header.",
      );
    }
    const raw =
      typeof payload.rawData === "string"
        ? payload.rawData
        : Buffer.isBuffer(payload.rawData)
          ? payload.rawData.toString("utf8")
          : JSON.stringify(payload.rawData);

    let event: Stripe.Event;
    try {
      event = this.stripe_.webhooks.constructEvent(
        raw,
        signature,
        this.options_.webhookSecret,
      );
    } catch (err) {
      await recordWebhookSecurityEvent("stripe", "signature_failure");
      console.error(
        "[payment-webhook] verification_failed provider=stripe reason=invalid_signature",
        err,
      );
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Invalid Stripe webhook signature.",
      );
    }

    const handledTypes = new Set([
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.expired",
    ]);
    if (!handledTypes.has(event.type)) {
      return { action: PaymentActions.NOT_SUPPORTED };
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const medusaSessionId = session.metadata?.session_id;
    if (!medusaSessionId) {
      return { action: PaymentActions.NOT_SUPPORTED };
    }

    const expectedAmount = Number(session.metadata?.amount_minor);
    const expectedCurrency = session.metadata?.currency?.trim().toLowerCase();
    const actualCurrency = session.currency?.trim().toLowerCase();
    if (
      !Number.isSafeInteger(expectedAmount) ||
      expectedAmount < 1 ||
      sessionAmountMinor(session.amount_total) !== expectedAmount ||
      !expectedCurrency ||
      !actualCurrency ||
      actualCurrency !== expectedCurrency
    ) {
      console.error(
        "[payment-webhook] verification_failed provider=stripe reason=amount_or_currency_mismatch",
      );
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Stripe webhook amount or currency does not match the checkout session.",
      );
    }

    const dedupId = buildStripeWebhookDedupId(event);
    if (dedupId) {
      const isFirst = await claimStripeWebhookDedup(dedupId);
      if (!isFirst) {
        return { action: PaymentActions.NOT_SUPPORTED };
      }
    }

    const amountMinor = sessionAmountMinor(session.amount_total);
    const data = { session_id: medusaSessionId, amount: amountMinor };

    if (event.type === "checkout.session.expired") {
      return { action: PaymentActions.CANCELED, data };
    }

    if (session.status !== "complete" || session.payment_status !== "paid") {
      console.error(
        "[payment-webhook] verification_failed provider=stripe reason=session_not_paid",
      );
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Stripe checkout session is not complete and paid.",
      );
    }

    return { action: PaymentActions.SUCCESSFUL, data };
  }
}
