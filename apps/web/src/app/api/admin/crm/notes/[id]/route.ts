import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { insertStaffAuditLog } from "@/lib/staff-audit";
import { resolveStaffOrganization } from "@/lib/staff-organization";

type RouteCtx = { params: Promise<{ id: string }> };

async function deleteHandler(req: NextRequest, ctx: RouteCtx) {
  const cid = getCorrelationId(req);
  const { id } = await ctx.params;
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "crm:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }

  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });

  const { data: existing, error: fetchErr } = await sup.client
    .from("staff_customer_notes")
    .select("id,customer_email,author_email")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .single();

  if (fetchErr || !existing) {
    return correlatedJson(cid, { error: "Note not found" }, { status: 404 });
  }

  const { error } = await sup.client
    .from("staff_customer_notes")
    .update({ is_deleted: true })
    .eq("id", id)
    .eq("organization_id", organization.id);

  if (error) {
    return correlatedJson(cid, { error: "Unable to delete note" }, { status: 500 });
  }

  await insertStaffAuditLog(sup.client, {
    actorEmail: session.user.email?.trim() ?? "unknown",
    action: "crm.note.delete",
    resource: `customer:${existing.customer_email}`,
    details: { noteId: id },
  });

  return correlatedJson(cid, { ok: true });
}

export const DELETE = withAdminMutationIdempotency("/admin/crm/notes/[id]:DELETE", deleteHandler);
