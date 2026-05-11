import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { staffSessionAllows } from "@apparel-commerce/database";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { authOptions } from "@/lib/auth";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { insertStaffAuditLog } from "@/lib/staff-audit";

type RouteCtx = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const cid = getCorrelationId(req);
  const { id } = await ctx.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "crm:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }

  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;

  const { data: existing, error: fetchErr } = await sup.client
    .from("staff_customer_notes")
    .select("id,customer_email,author_email")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    return correlatedJson(cid, { error: "Note not found" }, { status: 404 });
  }

  const { error } = await sup.client
    .from("staff_customer_notes")
    .update({ is_deleted: true })
    .eq("id", id);

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
