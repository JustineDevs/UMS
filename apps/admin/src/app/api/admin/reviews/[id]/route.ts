import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { z } from "zod";
import { parseAdminJson } from "@/lib/admin-api-security";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { insertStaffAuditLog } from "@/lib/staff-audit";
import { correlatedJson } from "@/lib/staff-api-response";

export const dynamic = "force-dynamic";
const moderationSchema = z
  .object({
    status: z.enum(["approved", "rejected", "hidden", "pending"]),
    moderation_note: z.string().trim().max(2000).optional().default(""),
    shadow_banned: z.boolean().optional(),
    expected_updated_at: z.string().datetime().optional(),
  })
  .strict();

async function patch(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("content:write");
  if (!staff.ok) return staff.response;
  const reviewId = (await ctx.params).id?.trim();
  if (!reviewId)
    return correlatedJson(
      correlationId,
      { error: "Missing id" },
      { status: 400 },
    );
  const parsed = await parseAdminJson(req, moderationSchema);
  if (!parsed.ok)
    return correlatedJson(
      correlationId,
      { error: parsed.error },
      { status: parsed.status },
    );
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const staffEmail =
    staff.session.user?.email?.trim().toLowerCase() ?? "unknown";
  let update = sup.client
    .from("product_reviews")
    .update({
      status: parsed.data.status,
      moderated_by_staff_email: staffEmail,
      moderated_at: new Date().toISOString(),
      moderation_note: parsed.data.moderation_note || null,
      ...(parsed.data.shadow_banned === undefined ? {} : { shadow_banned: parsed.data.shadow_banned }),
    })
    .eq("id", reviewId);
  if (parsed.data.expected_updated_at)
    update = update.eq("updated_at", parsed.data.expected_updated_at);
  const { data, error } = await update.select("id,status").maybeSingle();
  if (error)
    return correlatedJson(
      correlationId,
      { error: "Unable to update review", code: "REVIEW_UPDATE_FAILED" },
      { status: 502 },
    );
  if (!data)
    return correlatedJson(
      correlationId,
      {
        error: parsed.data.expected_updated_at
          ? "Review changed; reload before moderating"
          : "Review not found",
      },
      { status: parsed.data.expected_updated_at ? 409 : 404 },
    );
  await insertStaffAuditLog(sup.client, {
    actorEmail: staffEmail,
    action: "review.moderate",
    resource: "product_reviews",
    resourceId: reviewId,
    details: { status: parsed.data.status },
  });
  return correlatedJson(correlationId, { ok: true, review: data });
}

export const PATCH = withAdminMutationIdempotency("/admin/reviews/[id]:PATCH", patch);
