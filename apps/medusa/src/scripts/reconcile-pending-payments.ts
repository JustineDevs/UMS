import type { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  PaymentActions,
} from "@medusajs/framework/utils";
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows";

const XENDIT_API = "https://api.xendit.co";

function basicAuth(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

type XenditSessionJson = {
  status?: string;
  amount?: number;
  reference_id?: string;
  payment_request_id?: string;
  payment_id?: string;
  data?: {
    status?: string;
    amount?: number;
    reference_id?: string;
    payment_request_id?: string;
    payment_id?: string;
  };
};

async function fetchXenditSessionCompleted(
  sessionId: string,
  secretKey: string,
): Promise<{ completed: boolean; amountMinor: number }> {
  const res = await fetch(`${XENDIT_API}/sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET",
    headers: {
      Authorization: basicAuth(secretKey),
      Accept: "application/json",
    },
  });
  const text = await res.text();
  if (!res.ok) {
    return { completed: false, amountMinor: 0 };
  }
  let json: XenditSessionJson;
  try {
    json = JSON.parse(text) as XenditSessionJson;
  } catch {
    return { completed: false, amountMinor: 0 };
  }
  const data = json.data ?? {};
  const status = (data.status ?? json.status ?? "").toUpperCase();
  if (status !== "COMPLETED" && status !== "SUCCESS" && status !== "PAID") {
    return { completed: false, amountMinor: 0 };
  }
  const amountMinor = Math.round(Number(data.amount ?? json.amount ?? 0));
  return {
    completed: true,
    amountMinor: Number.isFinite(amountMinor) ? Math.max(0, amountMinor) : 0,
  };
}

type PaymentSessionRow = {
  id?: string;
  status?: string;
  provider_id?: string;
  data?: Record<string, unknown>;
  created_at?: string | Date;
};

/**
 * Polls gateway state for Xendit sessions stuck in `requires_more` / `pending`
 * after checkout (missed webhook). Completes payment via the same workflow as
 * {@link processPaymentWorkflow} when the session is paid.
 */
export default async function reconcilePendingPayments({
  container,
}: ExecArgs): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as {
    info: (m: string) => void;
    warn: (m: string) => void;
  };
  const minutes = Math.max(1, Number(process.env.MEDUSA_RECONCILE_MINUTES ?? "30"));
  const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();

  const secretKey = process.env.XENDIT_SECRET_KEY?.trim();
  if (!secretKey) {
    logger.warn(
      "[reconcile-pending-payments] XENDIT_SECRET_KEY not set — skipping Xendit reconciliation.",
    );
    return;
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  let sessions: PaymentSessionRow[] = [];
  try {
    const { data } = await query.graph({
      entity: "payment_session",
      fields: ["id", "status", "provider_id", "data", "created_at"],
      filters: {
        provider_id: { $ilike: "%xendit%" },
        created_at: { $lt: cutoff },
      },
    });
    sessions = (data ?? []) as PaymentSessionRow[];
  } catch (e) {
    logger.warn(
      `[reconcile-pending-payments] payment_session query failed: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
    return;
  }

  let processed = 0;
  for (const row of sessions) {
    const id = typeof row.id === "string" ? row.id : "";
    if (!id) continue;
    const st = (row.status ?? "").toLowerCase();
    if (st === "authorized" || st === "captured") continue;

    const data = row.data ?? {};
    const sessionId =
      typeof data.xendit_session_id === "string" ? data.xendit_session_id.trim() : "";
    if (!sessionId) continue;

    const { completed, amountMinor } = await fetchXenditSessionCompleted(sessionId, secretKey);
    if (!completed) continue;

    try {
      await processPaymentWorkflow(container).run({
        input: {
          action: PaymentActions.SUCCESSFUL,
          data: {
            session_id: id,
            amount: amountMinor,
          },
        },
      });
      processed += 1;
      logger.info(
        `[reconcile-pending-payments] Completed stuck Xendit session ${id} (session ${sessionId}).`,
      );
    } catch (e) {
      logger.warn(
        `[reconcile-pending-payments] processPaymentWorkflow failed for ${id}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  logger.info(
    `[reconcile-pending-payments] Scanned ${sessions.length} Xendit session(s) older than ${minutes}m; reconciled ${processed}.`,
  );
}
