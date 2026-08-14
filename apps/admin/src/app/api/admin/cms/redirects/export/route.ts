import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { listCmsRedirects } from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { resolveStaffOrganization } from "@/lib/staff-organization";

function esc(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!staffSessionAllows(session, "content:read")) return new Response("Forbidden", { status: 403 });
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return new Response("Tenant scope unavailable", { status: 403 });
  const rows = await listCmsRedirects(sup.client, organization.id);
  const lines = [
    ["from_path", "to_path", "status_code", "active", "preserve_query"].join(","),
  ];
  for (const r of rows) {
    lines.push(
      [
        esc(r.from_path),
        esc(r.to_path),
        String(r.status_code),
        r.active ? "1" : "0",
        r.preserve_query ? "1" : "0",
      ].join(","),
    );
  }
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cms-redirects-${cid.slice(0, 8)}.csv"`,
    },
  });
}
