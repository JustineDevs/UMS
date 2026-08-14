import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { getPaymentAttemptByCorrelationId, updatePaymentAttemptByCorrelationId } from "@universal-music-store/platform-data";

import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { correlatedJson } from "@/lib/staff-api-response";
import { randomUUID } from "crypto";
import { insertStaffAuditLog } from "@/lib/staff-audit";

export const dynamic = "force-dynamic";

async function post(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const correlationId = randomUUID();
  const staff = await requireStaffApiSession("orders:write");
  if (!staff.ok) return staff.response;

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return correlatedJson(correlationId, { error: "Missing id" }, { status: 400 });
  }

  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;

  const row = await getPaymentAttemptByCorrelationId(sup.client, id.trim());
  if (!row) {
    return correlatedJson(correlationId, { error: "Not found" }, { status: 404 });
  }

  await updatePaymentAttemptByCorrelationId(sup.client, id.trim(), {
    status: "needs_review",
    checkout_state: "needs_review",
    last_error: (row.last_error ? `${row.last_error}; ` : "") + "escalated_by_operator",
  });
  await insertStaffAuditLog(sup.client, {
    actorEmail: typeof staff.session.user?.email === "string" ? staff.session.user.email : "unknown",
    action: "payment.mark_review",
    resource: "payment_attempt",
    resourceId: id.trim(),
    details: { status: "needs_review" },
  });

  return correlatedJson(correlationId, { ok: true });
}

export const POST = withAdminMutationIdempotency("/admin/payments/[id]/mark-review:POST", post);
