import type { WorkerDatabaseClient } from "./database.ts";
import { createCommerceJob, enqueueCommerceJob, type WorkerQueue } from "./queue.ts";
import { applyProviderRefundUpdate, providerRefundUpdate } from "./refund-reconciliation.ts";

const encoder = new TextEncoder();

export type WorkerWebhookEnv = {
  STRIPE_WEBHOOK_SECRET?: string;
  PAYPAL_WEBHOOK_ID?: string;
  PAYPAL_WEBHOOK_SECRET?: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_ENVIRONMENT?: string;
  XENDIT_WEBHOOK_TOKEN?: string;
  PANCAKE_POS_API_KEY?: string;
  PAYPAL_FETCHER?: typeof fetch;
  COMMERCE_QUEUE?: WorkerQueue;
};

export type QueuedWebhookProvider = WebhookProvider;

export type QueuedWebhookPayload = {
  provider: QueuedWebhookProvider;
  rawBody: string;
  headers: Record<string, string>;
};

function fromHex(value: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;
  const output = new Uint8Array(value.length / 2);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return output;
}

function fromBase64(value: string): Uint8Array | null {
  try {
    const decoded = atob(value);
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(message)),
  );
}

export async function verifyHmacSha256Hex(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expected = await hmac(secret, payload);
  const received = fromHex(signature.trim());
  return received !== null && constantTimeEqual(expected, received);
}

export async function verifyHmacSha256Base64(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expected = await hmac(secret, payload);
  const received = fromBase64(signature.trim());
  return received !== null && constantTimeEqual(expected, received);
}

export function verifyExactWebhookToken(
  received: string | null,
  expected: string,
): boolean {
  if (!received || !expected) return false;
  const left = encoder.encode(received);
  const right = encoder.encode(expected);
  return constantTimeEqual(left, right);
}

export type StripeSignatureOptions = {
  toleranceSeconds?: number;
  nowSeconds?: number;
};

export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  options: StripeSignatureOptions = {},
): Promise<boolean> {
  if (!header) return false;
  const values = new Map<string, string[]>();
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    values.set(key, [...(values.get(key) ?? []), value]);
  }
  const timestamp = Number(values.get("t")?.[0]);
  if (!Number.isSafeInteger(timestamp)) return false;
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = options.toleranceSeconds ?? 300;
  if (Math.abs(now - timestamp) > tolerance) return false;
  const expected = await hmac(secret, `${timestamp}.${payload}`);
  return (values.get("v1") ?? []).some((candidate) => {
    const received = fromHex(candidate);
    return received !== null && constantTimeEqual(expected, received);
  });
}

export type WebhookProvider = "stripe" | "paypal" | "xendit" | "pancake";

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

const WEBHOOK_SIGNATURE_HEADERS = [
  "stripe-signature",
  "paypal-transmission-id",
  "paypal-transmission-time",
  "paypal-transmission-sig",
  "paypal-auth-algo",
  "paypal-cert-url",
  "authorization",
  "x-callback-token",
  "x-webhook-token",
  "x-signature",
] as const;

function queuedWebhookHeaders(request: Request): Record<string, string> {
  return Object.fromEntries(
    WEBHOOK_SIGNATURE_HEADERS.flatMap((name) => {
      const value = request.headers.get(name);
      return value ? [[name, value]] : [];
    }),
  );
}

function eventId(provider: WebhookProvider, value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const candidate = provider === "stripe"
    ? record.id
    : (record.id ?? record.event_id ?? record.eventId);
  if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  if (provider !== "xendit") return null;
  const resource = recordAt(record.data);
  const resourceId = stringField(resource, "id");
  const type = stringField(record, "event", "event_type", "type");
  if (!resourceId || !type) return null;
  const version = stringField(resource, "updated") ?? stringField(record, "created");
  return `xendit:${type}:${resourceId}${version ? `:${version}` : ""}`.slice(0, 255);
}

function recordAt(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nestedRecord(
  value: unknown,
  ...keys: string[]
): Record<string, unknown> | null {
  let current: unknown = value;
  for (const key of keys) {
    const record = recordAt(current);
    current = record?.[key];
  }
  return recordAt(current);
}

function stringField(
  record: Record<string, unknown> | null,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function providerCorrelation(body: unknown): string | null {
  const root = recordAt(body);
  const object =
    nestedRecord(root, "data", "object") ??
    nestedRecord(root, "data") ??
    nestedRecord(root, "resource") ??
    root;
  const metadata = recordAt(object?.metadata) ?? recordAt(object?.custom_data);
  const correlation =
    stringField(
      metadata,
      "correlation_id",
      "correlationId",
      "uvs_correlation_id",
    ) ?? stringField(object, "custom_id", "reference_id", "correlation_id");
  return correlation &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      correlation,
    )
    ? correlation
    : null;
}

function providerObjectId(body: unknown): {
  sessionId: string | null;
  paymentId: string | null;
} {
  const root = recordAt(body);
  const object =
    nestedRecord(root, "data", "object") ??
    nestedRecord(root, "data") ??
    nestedRecord(root, "resource") ??
    root;
  const type = eventType(body);
  const objectId = stringField(object, "id");
  if (type?.startsWith("checkout.session.") && objectId)
    return {
      sessionId: objectId,
      paymentId: stringField(object, "payment_intent"),
    };
  return {
    sessionId: stringField(
      object,
      "session_id",
      "payment_session_id",
      "checkout_session_id",
      "order_id",
    ),
    paymentId: stringField(
      object,
      "payment_intent",
      "payment_id",
      "payment_request_id",
      "capture_id",
      "id",
    ),
  };
}

function eventType(body: unknown): string | null {
  return (
    stringField(
      recordAt(body),
      "type",
      "event_type",
      "event",
      "status",
    )?.toLowerCase() ?? null
  );
}

function paymentStatus(
  provider: WebhookProvider,
  type: string | null,
): string | null {
  if (!type) return null;
  if (
    (provider === "stripe" &&
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "payment_intent.succeeded",
      ].includes(type)) ||
    (provider === "paypal" &&
      ["payment.capture.completed", "checkout.order.completed"].includes(
        type,
      )) ||
    (provider === "xendit" &&
      ["paid", "succeeded", "payment.succeeded", "capture"].includes(type))
  )
    return "paid";
  if (["cancelled", "canceled"].includes(type)) return "cancelled";
  if (
    [
      "failed",
      "payment_failed",
      "payment.failed",
      "checkout.session.expired",
      "expired",
    ].includes(type)
  )
    return "failed";
  if (["pending", "processing", "requires_action"].includes(type))
    return "pending";
  return null;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyProviderWebhook(
  provider: WebhookProvider,
  request: Request,
  rawBody: string,
  body: unknown,
  env: WorkerWebhookEnv,
): Promise<boolean> {
  if (provider === "stripe")
    return verifyStripeSignature(
      rawBody,
      request.headers.get("stripe-signature"),
      env.STRIPE_WEBHOOK_SECRET ?? "",
    );
  if (provider === "paypal") {
    const transmissionId = request.headers.get("paypal-transmission-id");
    const transmissionTime = request.headers.get("paypal-transmission-time");
    const transmissionSig = request.headers.get("paypal-transmission-sig");
    const authAlgo = request.headers.get("paypal-auth-algo");
    const certUrl = request.headers.get("paypal-cert-url");
    if (
      !transmissionId ||
      !transmissionTime ||
      !transmissionSig ||
      !authAlgo ||
      !certUrl ||
      !env.PAYPAL_WEBHOOK_ID ||
      !env.PAYPAL_CLIENT_ID ||
      !env.PAYPAL_CLIENT_SECRET
    )
      return false;
    const base =
      (env.PAYPAL_ENVIRONMENT ?? "sandbox") === "production"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
    const fetcher = env.PAYPAL_FETCHER ?? fetch;
    const tokenResponse = await fetcher(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!tokenResponse.ok) return false;
    const tokenBody = (await tokenResponse.json()) as {
      access_token?: unknown;
    };
    if (typeof tokenBody.access_token !== "string") return false;
    const verificationResponse = await fetcher(
      `${base}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenBody.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: env.PAYPAL_WEBHOOK_ID,
          webhook_event: body,
        }),
      },
    );
    if (!verificationResponse.ok) return false;
    const verification = (await verificationResponse.json()) as {
      verification_status?: unknown;
    };
    return verification.verification_status === "SUCCESS";
  }
  const token =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-callback-token") ??
    request.headers.get("x-webhook-token") ??
    request.headers.get("x-signature");
  const expected =
    provider === "xendit"
      ? env.XENDIT_WEBHOOK_TOKEN
      : provider === "pancake"
        ? env.PANCAKE_POS_API_KEY
        : env.PAYPAL_WEBHOOK_SECRET;
  if (!token || !expected) return false;
  return verifyExactWebhookToken(token, expected) && Boolean(body);
}

export async function handleWorkerWebhookRequest(
  request: Request,
  database: WorkerDatabaseClient,
  provider: WebhookProvider,
  env: WorkerWebhookEnv,
  refundAuditDatabase?: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, 405);
  const rawBody = await request.text();
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!(await verifyProviderWebhook(provider, request, rawBody, body, env)))
    return json({ error: "invalid_webhook_signature" }, 401);
  const id = eventId(provider, body);
  if (!id) return json({ error: "webhook_event_id_required" }, 400);
  const type = eventType(body);
  const refundUpdate = provider === "pancake"
    ? null
    : providerRefundUpdate(provider, type, body);
  const status = paymentStatus(provider, type);
  const correlationId = providerCorrelation(body);
  const providerIds = providerObjectId(body);
  const payloadHash = await sha256Hex(rawBody);
  const paymentEvent = await database.query<{ inserted: boolean }>(
    `INSERT INTO public.payment_webhook_events
       (provider, event_id, event_type, payload_hash, payload, received_at, status, correlation_id)
     VALUES ($1, $2, $3, $4, $5::jsonb, now(), 'received', $6::uuid)
     ON CONFLICT (provider, event_id) DO NOTHING
     RETURNING true AS inserted`,
    [provider, id, type, payloadHash, rawBody, correlationId],
  );
  const duplicate = paymentEvent.rows.length === 0;
  if (
    !duplicate &&
    !refundUpdate &&
    (correlationId || providerIds.sessionId || providerIds.paymentId) &&
    status
  ) {
    const attemptUpdate = await database.query<{ correlation_id: string }>(
      `UPDATE public.payment_attempts
       SET status = CASE
           WHEN status IN ('paid', 'completed', 'refunded')
             AND $1 IN ('pending', 'failed', 'cancelled') THEN status
           ELSE $1
         END,
           checkout_state = CASE
             WHEN status IN ('paid', 'completed', 'refunded')
               AND $1 IN ('pending', 'failed', 'cancelled') THEN checkout_state
             WHEN $1 = 'paid' THEN 'provider_verified'
             ELSE 'needs_review'
           END,
           provider_payload = COALESCE(provider_payload, '{}'::jsonb) || $2::jsonb,
           webhook_last_event_id = $3,
           webhook_last_status = $1,
           updated_at = now()
       WHERE provider = $4
         AND ($5::uuid IS NOT NULL AND correlation_id = $5::uuid
              OR $5::uuid IS NULL AND (provider_session_id = $6 OR provider_payment_id = $7))
       RETURNING correlation_id`,
      [
        status,
        rawBody,
        id,
        provider,
        correlationId,
        providerIds.sessionId,
        providerIds.paymentId,
      ],
    );
    const resolvedCorrelationId = attemptUpdate.rows[0]?.correlation_id;
    if (attemptUpdate.rowCount === 1 && resolvedCorrelationId) {
      await database.query(
        `UPDATE public.payment_webhook_events
         SET processed_at = now(), status = 'processed', correlation_id = COALESCE(correlation_id, $3::uuid)
         WHERE provider = $1 AND event_id = $2`,
        [provider, id, resolvedCorrelationId],
      );
      if (env.COMMERCE_QUEUE) {
        await enqueueCommerceJob(
          env.COMMERCE_QUEUE,
          createCommerceJob("webhook-finalization", {
            provider,
            eventId: id,
            correlationId: resolvedCorrelationId,
          }),
        );
      }
    }
  }
  if (refundUpdate) {
    if (!refundAuditDatabase) return json({ error: "refund_audit_unavailable" }, 503);
    await applyProviderRefundUpdate(refundAuditDatabase, provider as "stripe" | "paypal" | "xendit", refundUpdate);
  }
  return json(
    {
      accepted: true,
      duplicate,
      provider,
      event_id: id,
    },
    202,
  );
}

/** Verify at the edge, then hand persistence to the retryable Commerce Queue. */
export async function enqueueWorkerWebhookRequest(
  request: Request,
  provider: WebhookProvider,
  env: WorkerWebhookEnv,
): Promise<Response> {
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, 405);
  if (!env.COMMERCE_QUEUE)
    return json({ error: "webhook_queue_unavailable" }, 503);
  const rawBody = await request.text();
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!(await verifyProviderWebhook(provider, request, rawBody, body, env)))
    return json({ error: "invalid_webhook_signature" }, 401);
  const id = eventId(provider, body);
  if (!id) return json({ error: "webhook_event_id_required" }, 400);
  await enqueueCommerceJob(
    env.COMMERCE_QUEUE,
    createCommerceJob<QueuedWebhookPayload>("webhook-persistence", {
      provider,
      rawBody,
      headers: queuedWebhookHeaders(request),
    }),
  );
  return json({ accepted: true, queued: true, provider, event_id: id }, 202);
}
