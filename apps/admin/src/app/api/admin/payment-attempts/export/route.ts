import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { insertStaffAuditLog } from "@/lib/staff-audit";
import { getCorrelationId } from "@/lib/request-correlation";

export const dynamic = "force-dynamic";
function csv(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
export async function GET(_request: Request) {
  const staff = await requireStaffApiSession("analytics:export");
  if (!staff.ok) return staff.response;
  const cid = getCorrelationId(_request);
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(
    sup.client,
    staff.session.user?.email,
  );
  if (!organization)
    return new Response("Tenant scope unavailable", { status: 403 });
  const { data, error } = await sup.client
    .from("payment_attempts")
    .select("id,provider,status,amount_minor,currency,updated_at")
    .eq("organization_id", organization.id)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error)
    return new Response("Unable to export payment attempts", { status: 502 });
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const lines = [
    ["id", "provider", "status", "amount_minor", "currency", "updated_at"],
    ...rows.map((row) => [
      row.id,
      row.provider,
      row.status,
      row.amount_minor,
      row.currency,
      row.updated_at,
    ]),
  ].map((row) => row.map(csv).join(","));
  const body = `${lines.join("\n")}\n`;
  if (new TextEncoder().encode(body).byteLength > 5 * 1024 * 1024)
    return new Response("Export too large", { status: 413 });
  await insertStaffAuditLog(sup.client, {
    actorEmail: staff.session.user?.email ?? "unknown",
    action: "payment_attempts.export",
    resource: "payment_attempts",
    details: {
      organization_id: organization.id,
      count: rows.length,
      correlation_id: cid,
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=payment-attempts.csv",
      "Cache-Control": "no-store",
    },
  });
}
