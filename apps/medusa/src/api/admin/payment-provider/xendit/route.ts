import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import {
  chargeXenditPaymentToken,
  captureXenditPayment,
  createXenditPayout,
  getXenditPaymentRequest,
} from "../../../../lib/xendit-sdk-client";
import { getNangoPaymentCredentials } from "../../../../lib/nango-payment-credentials";

const operationSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("reconcile"), period_start: z.string().datetime(), period_end: z.string().datetime(), payment_request_ids: z.array(z.string().trim().min(8).max(160)).min(1).max(100), idempotency_key: z.string().trim().min(8).max(255) }).strict(),
  z.object({ operation: z.literal("payment"), action: z.enum(["retrieve", "capture"]), payment_request_id: z.string().trim().min(8).max(160), payment_id: z.string().trim().min(8).max(160).optional(), idempotency_key: z.string().trim().min(8).max(255) }).strict(),
  z.object({
    operation: z.literal("future_charge"),
    payment_token_id: z.string().trim().min(8).max(160),
    reference_id: z.string().trim().min(1).max(127),
    amount_minor: z.number().int().positive().max(10_000_000_000),
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/),
    country: z.string().trim().regex(/^[A-Za-z]{2}$/),
    channel_code: z.string().trim().min(2).max(80),
    channel_properties: z.record(z.string(), z.unknown()).default({}),
    metadata: z.record(z.string(), z.string().max(500)).optional(),
    idempotency_key: z.string().trim().min(8).max(255),
  }).strict(),
  z.object({
    operation: z.literal("payout"),
    reference_id: z.string().trim().min(1).max(127),
    channel_code: z.string().trim().min(2).max(80),
    amount_minor: z.number().int().positive().max(10_000_000_000),
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/),
    channel_properties: z.record(z.string(), z.unknown()),
    description: z.string().trim().max(255).optional(),
    idempotency_key: z.string().trim().min(8).max(255),
  }).strict(),
]);

function validInternalToken(req: MedusaRequest): boolean {
  const expected = process.env.MEDUSA_INTERNAL_ADMIN_TOKEN?.trim();
  return Boolean(expected && req.headers["x-uvs-internal-token"] === expected);
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  if (!validInternalToken(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = operationSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid Xendit operation payload" });
    return;
  }
  const body = parsed.data;
  const context = {
    nango_connection_id: typeof req.headers["x-nango-connection-id"] === "string"
      ? req.headers["x-nango-connection-id"]
      : undefined,
    nango_provider_config_key: typeof req.headers["x-nango-provider-config-key"] === "string"
      ? req.headers["x-nango-provider-config-key"]
      : undefined,
  };
  const credentials = await getNangoPaymentCredentials(context);
  const secretKey = [credentials?.secret_key, credentials?.api_key, credentials?.secretKey]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0)
    ?.trim() || process.env.XENDIT_SECRET_KEY?.trim();
  if (!secretKey) {
    res.status(503).json({ error: "Xendit operation is not configured", code: "XENDIT_NOT_CONFIGURED" });
    return;
  }
  try {
    if (body.operation === "reconcile") {
      const start = new Date(body.period_start);
      const end = new Date(body.period_end);
      if (!(start < end)) return void res.status(400).json({ error: "Invalid reconciliation period" });
      const requests = await Promise.all(body.payment_request_ids.map((id) => getXenditPaymentRequest({ secretKey }, id)));
      const inPeriod = requests.filter((request) => request.referenceId || request.paymentRequestId);
      return void res.json({ operation: body.operation, data: { provider_api_pull: true, source: "payment_requests", period_start: start.toISOString(), period_end: end.toISOString(), transaction_count: inPeriod.length, statuses: inPeriod.reduce<Record<string, number>>((counts, request) => { counts[request.status] = (counts[request.status] ?? 0) + 1; return counts; }, {}), requests: inPeriod.map((request) => ({ payment_request_id: request.paymentRequestId, payment_id: request.paymentId ?? null, status: request.status, amount_minor: request.amountMinor ?? null, currency: request.currency ?? null, reference_id: request.referenceId ?? null })) } });
    }
    if (body.operation === "payment") {
      const before = await getXenditPaymentRequest({ secretKey }, body.payment_request_id);
      if (body.action === "capture") {
        if (!body.payment_id) return void res.status(400).json({ error: "payment_id is required for capture" });
        await captureXenditPayment({ secretKey }, { paymentId: body.payment_id, idempotencyKey: body.idempotency_key });
      }
      const result = await getXenditPaymentRequest({ secretKey }, body.payment_request_id);
      return void res.json({ operation: body.operation, data: { id: result.paymentId ?? before.paymentId ?? body.payment_request_id, payment_request_id: result.paymentRequestId, status: result.status, amount_minor: result.amountMinor, currency: result.currency, reference_id: result.referenceId } });
    }
    if (body.operation === "payout") {
      const result = await createXenditPayout({ secretKey }, {
        referenceId: body.reference_id,
        channelCode: body.channel_code,
        amountMinor: body.amount_minor,
        currency: body.currency,
        channelProperties: body.channel_properties,
        description: body.description,
        idempotencyKey: body.idempotency_key,
      });
      res.json({ data: result, operation: body.operation });
      return;
    }
    const result = await chargeXenditPaymentToken({ secretKey }, {
      referenceId: body.reference_id,
      amountMinor: body.amount_minor,
      currency: body.currency,
      country: body.country,
      channelCode: body.channel_code,
      paymentTokenId: body.payment_token_id,
      channelProperties: body.channel_properties,
      metadata: body.metadata,
      idempotencyKey: body.idempotency_key,
    });
    res.json({ data: result, operation: body.operation });
  } catch (error) {
    console.error("Xendit operation failed", error);
    res.status(502).json({
      error: "Xendit operation failed",
      code: "XENDIT_OPERATION_FAILED",
    });
  }
}
