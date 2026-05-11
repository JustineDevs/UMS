import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows";
import {
  enqueueReconciliationJob,
  findPaymentAttemptByMedusaOrderId,
  markWebhookProcessed,
  mergePaymentAttemptPayloadByMedusaOrderId,
  PAYMENT_RECONCILIATION_JOB_TYPES,
  recordWebhookEvent,
  tryCreateSupabaseClient,
} from "../../../lib/payment-supabase-bridge";
import {
  applyJntWebhookEvent,
  prepareJntWebhookEvent,
} from "./route-logic";
import { claimJntWebhookDedup } from "../../../lib/jnt-webhook-dedup";
import { releaseJntWebhookDedup } from "../../../lib/jnt-webhook-dedup";

function logJnt(
  logger: { info?: (_m: string) => void; warn?: (_m: string) => void },
  event: string,
  fields: Record<string, unknown>,
): void {
  const line = JSON.stringify({ source: "jnt_webhook", event, ts: new Date().toISOString(), ...fields });
  if (event.includes("fail") || event.includes("error")) {
    logger.warn?.(line);
  } else {
    logger.info?.(line);
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as {
    info?: (_m: string) => void;
    warn?: (_m: string) => void;
  };

  const secret = process.env.JNT_WEBHOOK_SECRET?.trim();

  const signature =
    (req.headers["x-jnt-signature"] as string | undefined) ??
    (req.headers["x-signature"] as string | undefined);

  const prepared = prepareJntWebhookEvent({
    secret,
    rawBody: req.rawBody,
    signatureHeader: signature,
  });
  if (!prepared.parsed) {
    res.status(prepared.status).json(prepared.body);
    return;
  }

  const supabase = tryCreateSupabaseClient();
  const orderModule = req.scope.resolve(Modules.ORDER);

  try {
    const result = await applyJntWebhookEvent({
      parsed: prepared.parsed,
      claimDedup: claimJntWebhookDedup,
      releaseDedupClaim: releaseJntWebhookDedup,
      recordWebhookEvent: async (input) => {
        if (!supabase) {
          return { inserted: false };
        }
        return recordWebhookEvent(supabase, input);
      },
      updateOrderMetadata: async (orderId, metadata) => {
        const existing = await orderModule.retrieveOrder(orderId, {
          select: ["id", "metadata"],
        });
        await orderModule.updateOrders(orderId, {
          metadata: {
            ...((existing.metadata as Record<string, unknown>) ?? {}),
            ...metadata,
          },
        });
      },
      mergePaymentAttemptPayload: async (orderId, merge) => {
        if (!supabase) {
          return;
        }
        await mergePaymentAttemptPayloadByMedusaOrderId(supabase, orderId, merge).catch(() => {});
      },
      getCodCaptureState: async (orderId) => {
        const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
        const { data: orders } = await query.graph({
          entity: "order",
          fields: ["payment_collections.*", "payment_collections.payments.*"],
          filters: { id: orderId },
        });
        const order = orders?.[0] as
          | {
              payment_collections?: Array<{
                payments?: Array<{ id: string; provider_id?: string; captured_at?: string | null }>;
              }>;
            }
          | undefined;
        const payments = order?.payment_collections?.[0]?.payments ?? [];
        const uncapturedCod = payments.find(
          (payment) =>
            payment.provider_id?.toLowerCase().includes("cod") && !payment.captured_at,
        );
        if (!uncapturedCod) {
          return null;
        }

        if (supabase) {
          const attempt = await findPaymentAttemptByMedusaOrderId(supabase, orderId);
          const prev =
            attempt?.provider_payload && typeof attempt.provider_payload === "object"
              ? (attempt.provider_payload as Record<string, unknown>)
              : {};
          return {
            paymentId: uncapturedCod.id,
            alreadyCaptured: prev.cod_capture_complete === true,
          };
        }

        return {
          paymentId: uncapturedCod.id,
          alreadyCaptured: false,
        };
      },
      captureCodPayment: async (paymentId) => {
        await capturePaymentWorkflow(req.scope).run({
          input: { payment_id: paymentId },
        });
      },
      enqueueCaptureRetry: async (orderId, error) => {
        if (!supabase) {
          return;
        }
        await enqueueReconciliationJob(
          supabase,
          PAYMENT_RECONCILIATION_JOB_TYPES.CAPTURE_COD_PAYMENT,
          { order_id: orderId, reason: "jnt_capture_failed", error },
          "jnt",
        ).catch(() => {});
      },
      markWebhookProcessed: async (id, ok, error) => {
        if (!supabase) {
          return;
        }
        await markWebhookProcessed(supabase, id, ok, error).catch(() => {});
      },
      nowIso: () => new Date().toISOString(),
      log: (event, fields) => logJnt(logger, event, fields),
    });

    res.status(result.status).json(result.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logJnt(logger, "dedup_unavailable", { error: message });
    if (message === "JNT_DEDUP_UNAVAILABLE") {
      res.status(503).json({
        error: "J&T webhook deduplication is not configured",
        code: "WEBHOOK_DEDUP_UNAVAILABLE",
      });
      return;
    }
    res.status(500).json({
      error: "Unable to process J&T webhook",
      code: "WEBHOOK_PROCESSING_FAILED",
    });
  }
}
