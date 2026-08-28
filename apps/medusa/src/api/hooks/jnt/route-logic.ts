import crypto from "node:crypto";

import { mapJntStatus } from "../../../lib/jnt-status-map";
import { buildJntWebhookDedupId } from "../../../lib/jnt-webhook-dedup";

export type JntParsedEvent = {
  orderId: string;
  statusCode: string | undefined;
  trackingNumber: string | undefined;
  dedupId: string;
  mappedStatus: string;
  lastCheckpoint: string;
  payloadHash: string;
};

export type JntRouteResult = {
  status: number;
  body: Record<string, unknown>;
};

export type JntCodCaptureState =
  | { paymentId: string; alreadyCaptured: boolean }
  | null;

type PrepareInput = {
  secret: string | undefined;
  rawBody: Buffer | undefined;
  signatureHeader: string | undefined;
  authMode?: "hmac" | "bearer";
};

const MAX_JNT_WEBHOOK_BODY_BYTES = 64 * 1024;

type ApplyInput = {
  parsed: JntParsedEvent;
  claimDedup: (_dedupId: string) => Promise<boolean>;
  releaseDedupClaim: (_dedupId: string) => Promise<void>;
  recordWebhookEvent: (_input: {
    provider: string;
    eventId: string;
    eventType?: string;
    payload: Record<string, unknown>;
    payloadHash?: string | null;
  }) => Promise<{ inserted: boolean; id?: string }>;
  updateOrderMetadata: (_orderId: string, _metadata: Record<string, unknown>) => Promise<void>;
  mergePaymentAttemptPayload: (
    _orderId: string,
    _merge: Record<string, unknown>,
  ) => Promise<void>;
  getCodCaptureState: (_orderId: string) => Promise<JntCodCaptureState>;
  captureCodPayment: (_paymentId: string) => Promise<void>;
  enqueueCaptureRetry: (_orderId: string, _error: string) => Promise<void>;
  markWebhookProcessed: (_id: string, _ok: boolean, _error?: string) => Promise<void>;
  nowIso: () => string;
  log: (_event: string, _fields: Record<string, unknown>) => void;
};

/**
 * J&T VIP webhook payload structure:
 * {
 *   "billCode": "JT1234567890",
 *   "status": "SIGNED",
 *   "statusDesc": "Delivered successfully",
 *   "orderNo": "<medusa_order_id>",
 *   "updateTime": "2026-04-18 10:00:00"
 * }
 */
type JntWebhookPayload = {
  billCode?: string;
  status?: string;
  statusDesc?: string;
  orderNo?: string;
  updateTime?: string;
};

export function verifyJntHmac(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) {
    return false;
  }
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(digest, "utf8");
    const b = Buffer.from(signatureHeader, "utf8");
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function verifyBearerToken(
  authorizationHeader: string | undefined,
  expectedToken: string,
): boolean {
  const supplied = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!supplied) return false;
  const a = Buffer.from(supplied, "utf8");
  const b = Buffer.from(expectedToken, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function pickMedusaOrderId(payload: JntWebhookPayload): string | undefined {
  if (typeof payload.orderNo === "string" && payload.orderNo.trim()) {
    const orderId = payload.orderNo.trim();
    return /^order_[A-Za-z0-9_-]+$/.test(orderId) ? orderId : undefined;
  }
  return undefined;
}

export function prepareJntWebhookEvent(
  input: PrepareInput,
): JntRouteResult & { parsed?: JntParsedEvent } {
  if (!input.secret?.trim()) {
    return {
      status: 503,
      body: { error: "Webhook signing not configured", code: "WEBHOOK_DISABLED" },
    };
  }

  if (!Buffer.isBuffer(input.rawBody)) {
    return {
      status: 400,
      body: { error: "Invalid body", code: "INVALID_BODY" },
    };
  }

  if (input.rawBody.length > MAX_JNT_WEBHOOK_BODY_BYTES) {
    return {
      status: 413,
      body: { error: "Webhook body is too large", code: "BODY_TOO_LARGE" },
    };
  }

  const authenticated =
    input.authMode === "bearer"
      ? verifyBearerToken(input.signatureHeader, input.secret)
      : verifyJntHmac(input.rawBody, input.signatureHeader, input.secret);
  if (!authenticated) {
    return {
      status: 401,
      body: { error: "Invalid signature", code: "INVALID_WEBHOOK_SIGNATURE" },
    };
  }

  let payload: JntWebhookPayload;
  try {
    payload = JSON.parse(input.rawBody.toString("utf8")) as JntWebhookPayload;
  } catch {
    return {
      status: 400,
      body: { error: "Invalid JSON", code: "INVALID_JSON" },
    };
  }

  const orderId = pickMedusaOrderId(payload);
  if (!orderId) {
    return { status: 200, body: { received: true, skipped: true } };
  }

  const statusCode = payload.status;
  const trackingNumber =
    typeof payload.billCode === "string" && payload.billCode.trim()
      ? payload.billCode.trim()
      : undefined;

  const checkpointParts = [payload.statusDesc, payload.updateTime].filter(Boolean);
  const lastCheckpoint = checkpointParts.join(" · ");

  const payloadHash = crypto
    .createHash("sha256")
    .update(input.rawBody)
    .digest("hex");

  return {
    status: 200,
    body: { received: true },
    parsed: {
      orderId,
      statusCode,
      trackingNumber,
      dedupId: buildJntWebhookDedupId(orderId, statusCode, payloadHash),
      mappedStatus: mapJntStatus(statusCode),
      lastCheckpoint,
      payloadHash,
    },
  };
}

export async function applyJntWebhookEvent(
  input: ApplyInput,
): Promise<JntRouteResult> {
  const {
    parsed,
    claimDedup,
    releaseDedupClaim,
    recordWebhookEvent,
    updateOrderMetadata,
    mergePaymentAttemptPayload,
    getCodCaptureState,
    captureCodPayment,
    enqueueCaptureRetry,
    markWebhookProcessed,
    nowIso,
    log,
  } = input;

  const isFirst = await claimDedup(parsed.dedupId);
  if (!isFirst) {
    log("deduped", { order_id: parsed.orderId, dedup_id: parsed.dedupId });
    return { status: 200, body: { received: true, duplicate: true } };
  }

  try {
    log("received", {
      order_id: parsed.orderId,
      status_code: parsed.statusCode ?? null,
      tracking_number: parsed.trackingNumber ?? null,
    });

    const webhookRecord = await recordWebhookEvent({
      provider: "jnt",
      eventId: parsed.dedupId,
      eventType: parsed.statusCode ?? "unknown",
      payload: {
        order_id: parsed.orderId,
        tracking: parsed.trackingNumber,
        status: parsed.statusCode,
      },
      payloadHash: parsed.payloadHash,
    });

    await updateOrderMetadata(parsed.orderId, {
      jnt_status_code: parsed.statusCode ?? null,
      jnt_status: parsed.mappedStatus,
      jnt_last_checkpoint: parsed.lastCheckpoint || null,
      jnt_updated_at: nowIso(),
    });

    await mergePaymentAttemptPayload(parsed.orderId, {
      jnt_status_code: parsed.statusCode ?? null,
      jnt_status: parsed.mappedStatus,
      jnt_tracking_number: parsed.trackingNumber ?? null,
      jnt_last_checkpoint: parsed.lastCheckpoint || null,
      ...(parsed.mappedStatus === "delivered"
        ? { jnt_delivered_at: nowIso() }
        : {}),
    });

    if (parsed.mappedStatus === "delivered") {
      log("delivered_processing", { order_id: parsed.orderId });
      try {
        const codCaptureState = await getCodCaptureState(parsed.orderId);
        if (codCaptureState?.paymentId) {
          if (codCaptureState.alreadyCaptured) {
            log("capture_skipped_already_captured", { order_id: parsed.orderId });
            if (webhookRecord.id) {
              await markWebhookProcessed(webhookRecord.id, true);
            }
            return {
              status: 200,
              body: { received: true, cod_capture: "already_captured" },
            };
          }

          await mergePaymentAttemptPayload(parsed.orderId, {
            cod_capture_started_at: nowIso(),
            cod_capture_source_pending: "jnt_webhook",
          });

          log("capture_started", {
            order_id: parsed.orderId,
            payment_id: codCaptureState.paymentId,
          });
          await captureCodPayment(codCaptureState.paymentId);
          log("capture_success", {
            order_id: parsed.orderId,
            payment_id: codCaptureState.paymentId,
          });
          await mergePaymentAttemptPayload(parsed.orderId, {
            cod_capture_complete: true,
            cod_capture_source: "jnt_webhook",
            cod_captured_at: nowIso(),
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log("capture_failed", { order_id: parsed.orderId, error: message });
        await mergePaymentAttemptPayload(parsed.orderId, {
          cod_capture_last_error: message.slice(0, 500),
          cod_needs_review: true,
        });
        await enqueueCaptureRetry(parsed.orderId, message);
      }
    }

    if (webhookRecord.id) {
      await markWebhookProcessed(webhookRecord.id, true);
    }

    return { status: 200, body: { received: true } };
  } catch (error) {
    await releaseDedupClaim(parsed.dedupId).catch(() => {});
    throw error;
  }
}
