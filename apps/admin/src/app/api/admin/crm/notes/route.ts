import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { staffSessionAllows } from "@apparel-commerce/database";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { authOptions } from "@/lib/auth";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { insertStaffAuditLog } from "@/lib/staff-audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getServerSession(authOptions);
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "crm:read")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const customerEmail = searchParams.get("customer_email")?.trim();
  if (!customerEmail) {
    return correlatedJson(cid, { error: "customer_email is required" }, { status: 400 });
  }

  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;

  const { data, error } = await sup.client
    .from("staff_customer_notes")
    .select("id,note_body,author_email,created_at,is_deleted")
    .eq("customer_email", customerEmail)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return correlatedJson(cid, { error: "Unable to fetch notes" }, { status: 500 });
  }

  return correlatedJson(cid, { data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getServerSession(authOptions);
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "crm:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return correlatedJson(cid, { error: "Invalid JSON" }, { status: 400 });
  }

  const rec = body as Record<string, unknown>;
  const customerEmail = typeof rec.customer_email === "string" ? rec.customer_email.trim() : "";
  const noteBody = typeof rec.note_body === "string" ? rec.note_body.trim() : "";

  if (!customerEmail || !noteBody) {
    return correlatedJson(cid, { error: "customer_email and note_body are required" }, { status: 400 });
  }
  if (noteBody.length > 4000) {
    return correlatedJson(cid, { error: "note_body must be at most 4000 characters" }, { status: 400 });
  }

  const authorEmail = session.user.email?.trim() ?? "unknown";
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;

  const { data, error } = await sup.client
    .from("staff_customer_notes")
    .insert({ customer_email: customerEmail, note_body: noteBody, author_email: authorEmail })
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
