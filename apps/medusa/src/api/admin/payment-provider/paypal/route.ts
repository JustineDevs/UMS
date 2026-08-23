import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { PaymentActions } from "@medusajs/framework/utils";
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows";
import { z } from "zod";
import { getNangoPaymentCredentials, nangoPaymentProxyConfigured } from "../../../../lib/nango-payment-credentials";
import { payPalRestJson, type PayPalClientOptions } from "../../../../lib/paypal-sdk-client";

const schema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("reconcile"), period_start: z.string().datetime(), period_end: z.string().datetime(), idempotency_key: z.string().trim().min(8).max(255) }).strict(),
  z.object({ operation: z.literal("invoice"), action: z.enum(["create", "send", "remind", "cancel"]), invoice_id: z.string().trim().min(1).max(255).optional(), payload: z.record(z.string(), z.unknown()).default({}), idempotency_key: z.string().trim().min(8).max(255) }).strict(),
  z.object({ operation: z.literal("payment"), action: z.enum(["retrieve", "authorize", "capture", "void", "confirm"]), order_id: z.string().trim().min(1).max(255).optional(), session_id: z.string().trim().min(1).max(255).optional(), amount: z.number().finite().positive().optional(), authorization_id: z.string().trim().min(1).max(255).optional(), idempotency_key: z.string().trim().min(8).max(255) }).strict(),
  z.object({ operation: z.literal("payment_link"), action: z.enum(["create", "retrieve", "deactivate"]), payment_resource_id: z.string().trim().min(1).max(255).optional(), payload: z.record(z.string(), z.unknown()).default({}), idempotency_key: z.string().trim().min(8).max(255) }).strict(),
  z.object({ operation: z.literal("subscription"), action: z.enum(["create", "suspend", "cancel"]), subscription_id: z.string().trim().min(1).max(255).optional(), payload: z.record(z.string(), z.unknown()).default({}), idempotency_key: z.string().trim().min(8).max(255) }).strict(),
  z.object({ operation: z.literal("dispute"), action: z.enum(["get", "evidence", "accept", "escalate", "deny", "adjudicate"]), dispute_id: z.string().trim().min(1).max(255), payload: z.record(z.string(), z.unknown()).default({}), idempotency_key: z.string().trim().min(8).max(255) }).strict(),
  z.object({ operation: z.literal("payout"), payload: z.record(z.string(), z.unknown()), idempotency_key: z.string().trim().min(8).max(255) }).strict(),
]);

function validInternalToken(req: MedusaRequest): boolean {
  const expected = (
    process.env.MEDUSA_INTERNAL_ADMIN_TOKEN || process.env.MEDUSA_SECRET_API_KEY
  )?.trim();
  if (!expected) return false;
  const internalToken = req.headers["x-uvs-internal-token"];
  if (internalToken === expected) return true;
  return req.headers.authorization === `Basic ${Buffer.from(`${expected}:`, "utf8").toString("base64")}`;
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  if (!validInternalToken(req)) return void res.status(401).json({ error: "Unauthorized" });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return void res.status(400).json({ error: "Invalid PayPal operation payload" });
  const body = parsed.data;
  if (body.operation === "payment" && body.action === "confirm") {
    if (!body.session_id || !body.amount) return void res.status(400).json({ error: "session_id and amount are required" });
    try {
      const result = await processPaymentWorkflow(req.scope).run({
        input: {
          action: PaymentActions.SUCCESSFUL,
          data: {
            session_id: body.session_id,
            amount: body.amount,
          },
        },
      });
      return void res.json({ operation: body.operation, data: result });
    } catch (error) {
      console.error("PayPal confirmation workflow failed", error);
      return void res.status(502).json({ error: "PayPal confirmation failed", code: "PAYPAL_CONFIRM_FAILED" });
    }
  }
  const nangoConnectionId = typeof req.headers["x-nango-connection-id"] === "string" ? req.headers["x-nango-connection-id"] : undefined;
  const nangoProviderConfigKey = typeof req.headers["x-nango-provider-config-key"] === "string" ? req.headers["x-nango-provider-config-key"] : undefined;
  const nangoContext = {
    nango_connection_id: nangoConnectionId,
    nango_provider_config_key: nangoProviderConfigKey,
  };
  const credentials = nangoPaymentProxyConfigured(nangoContext)
    ? null
    : await getNangoPaymentCredentials(nangoContext);
  const clientId = String(credentials?.client_id ?? credentials?.clientId ?? "").trim();
  const clientSecret = String(credentials?.client_secret ?? credentials?.clientSecret ?? "").trim();
  const accessToken = String(credentials?.access_token ?? "").trim() || undefined;
  if ((!clientId || !clientSecret) && !accessToken && !nangoPaymentProxyConfigured(nangoContext)) return void res.status(503).json({ error: "PayPal operation is not configured", code: "PAYPAL_NOT_CONFIGURED" });
  const options: PayPalClientOptions = {
    clientId: clientId || "nango-managed",
    clientSecret,
    sandbox: String(process.env.PAYPAL_ENVIRONMENT ?? "sandbox").toLowerCase() !== "production",
    accessToken,
    nangoApiKey: process.env.NANGO_API_KEY?.trim(),
    nangoConnectionId: nangoConnectionId ?? process.env.NANGO_PAYMENT_CONNECTION_ID?.trim(),
    nangoProviderConfigKey: nangoProviderConfigKey ?? process.env.NANGO_PAYMENT_PROVIDER_CONFIG_KEY?.trim(),
  };
  try {
    if (body.operation === "reconcile") {
      const start = new Date(body.period_start).toISOString();
      const end = new Date(body.period_end).toISOString();
      if (!(new Date(start) < new Date(end))) return void res.status(400).json({ error: "Invalid reconciliation period" });
      const result = await payPalRestJson(options, `/v1/reporting/transactions?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}&fields=all&page_size=100`, { method: "GET" }) as { transaction_details?: unknown[]; total_items?: number; total_pages?: number };
      return void res.json({ operation: body.operation, data: { provider_api_pull: true, source: "transaction_reporting", period_start: start, period_end: end, transaction_count: result.transaction_details?.length ?? 0, total_items: result.total_items ?? null, total_pages: result.total_pages ?? null, transactions: (result.transaction_details ?? []).map((item) => { const row = item as Record<string, unknown>; const info = (row.transaction_info as Record<string, unknown> | undefined) ?? {}; return { external_id: String(row.transaction_id ?? ""), payment_external_id: typeof info.reference_id === "string" ? info.reference_id : null, amount_minor: Number((info.transaction_amount as Record<string, unknown> | undefined)?.value ?? 0) * 100, fee_minor: Number((info.fee_amount as Record<string, unknown> | undefined)?.value ?? 0) * 100, net_minor: Number((info.transaction_amount as Record<string, unknown> | undefined)?.value ?? 0) * 100, currency: String((info.transaction_amount as Record<string, unknown> | undefined)?.currency_code ?? "").toUpperCase(), status: String(info.transaction_status ?? "unknown"), provider_occurred_at: String(row.transaction_initiation_date ?? new Date().toISOString()) }; }).filter((row) => row.external_id) } });
    }
    let path: string;
    let method = "POST";
    let payload: unknown = undefined;
    if (body.operation === "payout") {
      path = "/v1/payments/payouts";
      payload = body.payload;
    } else if (body.operation === "payment") {
      const orderId = body.order_id;
      const authorizationId = body.authorization_id;
      if (body.action === "void") {
        if (!authorizationId) return void res.status(400).json({ error: "authorization_id is required" });
        path = `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`;
        method = "POST";
      } else {
        if (!orderId) return void res.status(400).json({ error: "order_id is required" });
        path = `/v2/checkout/orders/${encodeURIComponent(orderId)}${body.action === "capture" ? "/capture" : body.action === "authorize" ? "/authorize" : ""}`;
        method = body.action === "retrieve" ? "GET" : "POST";
      }
    } else if (body.operation === "payment_link") {
      const resourceId = body.payment_resource_id;
      if (body.action === "create") {
        path = "/v1/checkout/payment-resources";
        payload = body.payload;
      } else {
        if (!resourceId) return void res.status(400).json({ error: "payment_resource_id is required" });
        path = `/v1/checkout/payment-resources/${encodeURIComponent(resourceId)}`;
        method = body.action === "retrieve" ? "GET" : "DELETE";
      }
    } else if (body.operation === "invoice") {
      if (body.action === "create") { path = "/v2/invoicing/invoices"; payload = body.payload; }
      else { if (!body.invoice_id) return void res.status(400).json({ error: "invoice_id is required" }); path = `/v2/invoicing/invoices/${encodeURIComponent(body.invoice_id)}/${body.action}`; payload = body.payload; }
    } else if (body.operation === "subscription") {
      if (body.action === "create") { path = "/v1/billing/subscriptions"; payload = body.payload; }
      else { if (!body.subscription_id) return void res.status(400).json({ error: "subscription_id is required" }); path = `/v1/billing/subscriptions/${encodeURIComponent(body.subscription_id)}/${body.action}`; payload = body.payload; }
    } else {
      path = `/v1/customer/disputes/${encodeURIComponent(body.dispute_id)}`;
      if (body.action === "get") method = "GET";
      else if (body.action === "evidence") path += "/provide-evidence";
      else if (body.action === "accept") path += "/accept-claim";
      else if (body.action === "escalate") path += "/escalate";
      else if (body.action === "deny") path += "/deny-offer";
      else if (body.action === "adjudicate") path += "/adjudicate";
      payload = body.payload;
    }
    const result = await payPalRestJson(options, path, {
      method,
      headers: { "PayPal-Request-Id": body.idempotency_key },
      ...(method === "GET" ? {} : { body: JSON.stringify(payload ?? {}) }),
    });
    return void res.json({ operation: body.operation, data: result });
  } catch (error) {
    console.error("PayPal operation failed", error);
    return void res.status(502).json({ error: "PayPal operation failed", code: "PAYPAL_OPERATION_FAILED" });
  }
}
