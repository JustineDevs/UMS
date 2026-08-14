import { listRecentPaymentAttempts } from "@universal-music-store/platform-data";

import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { correlatedJson } from "@/lib/staff-api-response";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const correlationId = randomUUID();
  const staff = await requireStaffApiSession("dashboard:read");
  if (!staff.ok) return staff.response;

  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 80));

  try {
    const rows = await listRecentPaymentAttempts(sup.client, limit);
    return correlatedJson(correlationId, {
      attempts: rows.map((r) => ({
        id: r.id,
        correlationId: r.correlation_id,
        cartId: r.cart_id,
        provider: r.provider,
        status: r.status,
        checkoutState: r.checkout_state,
        amountMinor: r.amount_minor,
        currency: r.currency,
        medusaOrderId: r.medusa_order_id,
        quoteFingerprint: r.quote_fingerprint,
        staleReason: r.stale_reason,
        invalidatedAt: r.invalidated_at,
        invalidatedBy: r.invalidated_by,
        providerSessionId: r.provider_session_id,
        lastError: r.last_error,
        finalizeAttempts: r.finalize_attempts,
        webhookLastStatus: r.webhook_last_status,
        updatedAt: r.updated_at,
        finalizedAt: r.finalized_at,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "List failed";
    return correlatedJson(correlationId, { error: msg }, { status: 500 });
  }
}
