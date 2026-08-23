import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import Stripe from "stripe";
import { z } from "zod";
import { getNangoPaymentCredentials } from "../../../../lib/nango-payment-credentials";

const operationSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("setup_intent"), customer: z.string().trim().max(255).optional(), idempotency_key: z.string().trim().min(8).max(255) }).strict(),
  z.object({ operation: z.literal("subscription"), customer: z.string().trim().min(1).max(255), items: z.array(z.object({ price: z.string().trim().min(1).max(255), quantity: z.number().int().positive().max(1000).default(1) }).strict()).min(1).max(50), idempotency_key: z.string().trim().min(8).max(255) }).strict(),
  z.object({ operation: z.literal("invoice"), customer: z.string().trim().min(1).max(255).optional(), customer_email: z.string().email().max(320).optional(), invoice_id: z.string().trim().min(1).max(255).optional(), currency: z.string().trim().regex(/^[A-Za-z]{3}$/), items: z.array(z.object({ amount_minor: z.number().int().positive().max(10_000_000_000), description: z.string().trim().min(1).max(500) }).strict()).max(100).default([]), action: z.enum(["draft", "finalize", "pay", "send"]).default("draft"), idempotency_key: z.string().trim().min(8).max(255) }).strict(),
  z.object({ operation: z.literal("payment"), action: z.enum(["retrieve", "capture"]), payment_id: z.string().trim().min(1).max(255), idempotency_key: z.string().trim().min(8).max(255) }).strict(),
  z.object({ operation: z.literal("dispute"), dispute_id: z.string().trim().min(1).max(255), action: z.enum(["retrieve", "update", "close"]), evidence: z.record(z.string(), z.string().max(10000)).optional(), idempotency_key: z.string().trim().min(8).max(255) }).strict(),
  z.object({ operation: z.literal("payout"), amount_minor: z.number().int().positive().max(10_000_000_000), currency: z.string().trim().regex(/^[A-Za-z]{3}$/), method: z.enum(["standard", "instant"]).default("standard"), idempotency_key: z.string().trim().min(8).max(255) }).strict(),
  z.object({ operation: z.literal("reconcile"), period_start: z.string().datetime(), period_end: z.string().datetime(), idempotency_key: z.string().trim().min(8).max(255) }).strict(),
  z.object({ operation: z.literal("connect_account"), country: z.string().trim().regex(/^[A-Za-z]{2}$/), email: z.string().email().max(320).optional(), return_url: z.string().url().refine((value) => value.startsWith("https://"), "HTTPS required"), refresh_url: z.string().url().refine((value) => value.startsWith("https://"), "HTTPS required"), idempotency_key: z.string().trim().min(8).max(255) }).strict(),
]);

function validInternalToken(req: MedusaRequest): boolean {
  const expected = process.env.MEDUSA_INTERNAL_ADMIN_TOKEN?.trim();
  return Boolean(expected && req.headers["x-uvs-internal-token"] === expected);
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  if (!validInternalToken(req)) return void res.status(401).json({ error: "Unauthorized" });
  const parsed = operationSchema.safeParse(req.body ?? {});
  if (!parsed.success) return void res.status(400).json({ error: "Invalid Stripe operation payload" });
  const body = parsed.data;
  if (body.operation === "invoice" && !body.customer && !body.customer_email && !body.invoice_id) return void res.status(400).json({ error: "customer, customer_email, or invoice_id is required" });
  const context = {
    nango_connection_id: typeof req.headers["x-nango-connection-id"] === "string" ? req.headers["x-nango-connection-id"] : undefined,
    nango_provider_config_key: typeof req.headers["x-nango-provider-config-key"] === "string" ? req.headers["x-nango-provider-config-key"] : undefined,
  };
  const credentials = await getNangoPaymentCredentials(context);
  const apiKey = [credentials?.access_token, credentials?.secret_key, credentials?.api_key]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();
  if (!apiKey) return void res.status(503).json({ error: "Stripe operation is not configured", code: "STRIPE_NOT_CONFIGURED" });
  try {
    const stripe = new Stripe(apiKey, { typescript: true });
    const requestOptions = { idempotencyKey: body.idempotency_key };
    if (body.operation === "reconcile") {
      const start = Math.floor(new Date(body.period_start).getTime() / 1000);
      const end = Math.floor(new Date(body.period_end).getTime() / 1000);
      if (!(start < end)) return void res.status(400).json({ error: "Invalid reconciliation period" });
      const transactions = await stripe.balanceTransactions.list({ created: { gte: start, lt: end }, limit: 100 });
      const byCurrency: Record<string, { count: number; gross_minor: number; net_minor: number }> = {};
      for (const transaction of transactions.data) {
        const bucket = byCurrency[transaction.currency] ??= { count: 0, gross_minor: 0, net_minor: 0 };
        bucket.count += 1;
        bucket.gross_minor += transaction.amount;
        bucket.net_minor += transaction.net;
      }
      return void res.json({ operation: body.operation, data: { provider_api_pull: true, source: "balance_transactions", period_start: body.period_start, period_end: body.period_end, transaction_count: transactions.data.length, has_more: transactions.has_more, by_currency: byCurrency, transactions: transactions.data.map((transaction) => ({ external_id: transaction.id, payment_external_id: typeof transaction.source === "string" ? transaction.source : transaction.source?.id ?? null, amount_minor: transaction.amount, fee_minor: transaction.fee, net_minor: transaction.net, currency: transaction.currency.toUpperCase(), status: transaction.status, provider_occurred_at: new Date(transaction.created * 1000).toISOString() })) } });
    }
    if (body.operation === "setup_intent") {
      const result = await stripe.setupIntents.create({ customer: body.customer, automatic_payment_methods: { enabled: true } }, requestOptions);
      return void res.json({ operation: body.operation, data: { id: result.id, status: result.status, client_secret: result.client_secret } });
    }
    if (body.operation === "subscription") {
      const result = await stripe.subscriptions.create({ customer: body.customer, items: body.items }, requestOptions);
      return void res.json({ operation: body.operation, data: { id: result.id, status: result.status, latest_invoice: result.latest_invoice } });
    }
    if (body.operation === "invoice") {
      if (body.invoice_id) {
        const result = body.action === "finalize"
          ? await stripe.invoices.finalizeInvoice(body.invoice_id, {}, requestOptions)
          : body.action === "pay"
            ? await stripe.invoices.pay(body.invoice_id, {}, requestOptions)
            : body.action === "send"
              ? await stripe.invoices.sendInvoice(body.invoice_id, {}, requestOptions)
              : await stripe.invoices.retrieve(body.invoice_id);
        return void res.json({ operation: body.operation, data: { id: result.id, status: result.status, hosted_invoice_url: result.hosted_invoice_url } });
      }
      const customer = body.customer ?? (body.customer_email ? (await stripe.customers.create({ email: body.customer_email }, requestOptions)).id : undefined);
      if (!customer || body.items.length === 0) return void res.status(400).json({ error: "A customer and at least one invoice item are required" });
      const invoice = await stripe.invoices.create(
        { customer, collection_method: "send_invoice", days_until_due: 30, auto_advance: false },
        { idempotencyKey: `${body.idempotency_key}:invoice` },
      );
      for (const [index, item] of body.items.entries()) {
        await stripe.invoiceItems.create(
          { customer, invoice: invoice.id, amount: item.amount_minor, currency: body.currency.toLowerCase(), description: item.description },
          { idempotencyKey: `${body.idempotency_key}:item:${index}` },
        );
      }
      const result = body.action === "finalize"
        ? await stripe.invoices.finalizeInvoice(invoice.id, {}, { idempotencyKey: `${body.idempotency_key}:finalize` })
        : body.action === "pay"
          ? await stripe.invoices.pay(invoice.id, {}, { idempotencyKey: `${body.idempotency_key}:pay` })
          : body.action === "send"
            ? await stripe.invoices.sendInvoice(invoice.id, {}, { idempotencyKey: `${body.idempotency_key}:send` })
            : invoice;
      return void res.json({ operation: body.operation, data: { id: result.id, status: result.status, hosted_invoice_url: result.hosted_invoice_url } });
    }
    if (body.operation === "payment") {
      let payment = await stripe.paymentIntents.retrieve(body.payment_id);
      if (body.action === "capture" && payment.status === "requires_capture") {
        payment = await stripe.paymentIntents.capture(body.payment_id, {}, requestOptions);
      }
      return void res.json({ operation: body.operation, data: { id: payment.id, status: payment.status, amount: payment.amount, currency: payment.currency } });
    }
    if (body.operation === "dispute") {
      const result = body.action === "retrieve" ? await stripe.disputes.retrieve(body.dispute_id) : body.action === "close" ? await stripe.disputes.close(body.dispute_id) : await stripe.disputes.update(body.dispute_id, { evidence: body.evidence as Stripe.DisputeUpdateParams.Evidence });
      return void res.json({ operation: body.operation, data: { id: result.id, status: result.status } });
    }
    if (body.operation === "payout") {
      const result = await stripe.payouts.create({ amount: body.amount_minor, currency: body.currency.toLowerCase(), method: body.method }, requestOptions);
      return void res.json({ operation: body.operation, data: { id: result.id, status: result.status, amount: result.amount, currency: result.currency } });
    }
    const account = await stripe.accounts.create({ type: "express", country: body.country.toLowerCase(), email: body.email }, requestOptions);
    const link = await stripe.accountLinks.create({ account: account.id, refresh_url: body.refresh_url, return_url: body.return_url, type: "account_onboarding" });
    return void res.json({ operation: body.operation, data: { account_id: account.id, onboarding_url: link.url, expires_at: link.expires_at } });
  } catch (error) {
    console.error("Stripe operation failed", error);
    return void res.status(502).json({ error: "Stripe operation failed", code: "STRIPE_OPERATION_FAILED" });
  }
}
