import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { insertStaffAuditLog } from "@/lib/staff-audit";

function csvEscape(s: string) {
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!staffSessionAllows(session, "content:read")) {
    return new Response("Forbidden", { status: 403 });
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(
    sup.client,
    session.user.email,
  );
  if (!organization)
    return new Response("Tenant scope unavailable", { status: 403 });
  const sp = req.nextUrl.searchParams;
  const formKey = sp.get("form_key")?.trim();
  const from = sp.get("from")?.trim();
  const to = sp.get("to")?.trim();
  if ([formKey, from, to].some((value) => value && value.length > 64)) {
    return new Response("Invalid filters", { status: 400 });
  }
  if ([from, to].some((value) => value && Number.isNaN(Date.parse(value)))) {
    return new Response("Invalid date filter", { status: 400 });
  }
  let query = sup.client
    .from("cms_form_submissions")
    .select("id,form_key,created_at,read_at,assigned_to,spam_score,payload")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (formKey) query = query.eq("form_key", formKey);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  const { data, error } = await query;
  if (error)
    return new Response("Unable to export form submissions", { status: 502 });
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const lines = [
    [
      "id",
      "form_key",
      "created_at",
      "read_at",
      "assigned_to",
      "spam_score",
      "payload_json",
    ].join(","),
  ];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(String(r.id ?? "")),
        csvEscape(String(r.form_key ?? "")),
        csvEscape(String(r.created_at ?? "")),
        csvEscape(String(r.read_at ?? "")),
        csvEscape(String(r.assigned_to ?? "")),
        String(Number(r.spam_score) || 0),
        csvEscape(JSON.stringify(r.payload ?? {})),
      ].join(","),
    );
  }
  const body = lines.join("\n");
  if (new TextEncoder().encode(body).byteLength > 5 * 1024 * 1024) {
    return new Response("Export too large", { status: 413 });
  }
  await insertStaffAuditLog(sup.client, {
    actorEmail: session.user.email ?? "unknown",
    action: "cms.form_submissions.export",
    resource: "cms_form_submissions",
    details: {
      organization_id: organization.id,
      count: rows.length,
      correlation_id: cid,
    },
  });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="form-submissions-${cid.slice(0, 8)}.csv"`,
    },
  });
}
