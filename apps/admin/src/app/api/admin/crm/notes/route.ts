import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { insertStaffAuditLog } from "@/lib/staff-audit";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { parseAdminJson } from "@/lib/admin-api-security";
import { z } from "zod";

export const dynamic = "force-dynamic";

const noteSchema = z.object({
  customer_email: z.string().trim().toLowerCase().email().max(320),
  note_body: z.string().trim().min(1).max(4000),
}).strict();

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user?.email) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "crm:read")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const emailResult = noteSchema.shape.customer_email.safeParse(searchParams.get("customer_email") ?? "");
  if (!emailResult.success) {
    return correlatedJson(cid, { error: "customer_email is required" }, { status: 400 });
  }
  const customerEmail = emailResult.data;

  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });

  const { data, error } = await sup.client
    .from("staff_customer_notes")
    .select("id,note_body,author_email,created_at,is_deleted")
    .eq("customer_email", customerEmail)
    .eq("organization_id", organization.id)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return correlatedJson(cid, { error: "Unable to fetch notes" }, { status: 500 });
  }

  return correlatedJson(cid, { data: data ?? [] });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user?.email) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "crm:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }

  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const parsed = await parseAdminJson(req, noteSchema);
  if (!parsed.ok) return correlatedJson(cid, { error: parsed.error }, { status: parsed.status });
  const { customer_email: customerEmail, note_body: noteBody } = parsed.data;
  const authorEmail = session.user.email.trim().toLowerCase();

  const { data, error } = await sup.client
    .from("staff_customer_notes")
    .insert({ organization_id: organization.id, customer_email: customerEmail, note_body: noteBody, author_email: authorEmail })
    .select("id,note_body,author_email,created_at")
    .single();

  if (error) {
    return correlatedJson(cid, { error: "Unable to save note" }, { status: 500 });
  }

  await insertStaffAuditLog(sup.client, {
    actorEmail: authorEmail,
    action: "crm.note.create",
    resource: `customer:${customerEmail}`,
    details: { noteId: data.id },
  });

  return correlatedJson(cid, { data }, { status: 201 });
}

export const POST = withAdminMutationIdempotency("/admin/crm/notes:POST", post);
