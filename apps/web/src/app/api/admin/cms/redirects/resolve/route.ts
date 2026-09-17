import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { listCmsRedirects } from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";

function normPath(p: string) {
  const t = p.trim();
  if (!t) return "/";
  return t.startsWith("/") ? t : `/${t}`;
}

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "content:read")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const raw = req.nextUrl.searchParams.get("path") ?? "/";
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization required" }, { status: 403 });
  const all = await listCmsRedirects(sup.client, organization.id);
  const active = all.filter((r) => r.active);
  const byFrom = new Map(active.map((r) => [normPath(r.from_path), r]));

  const fromPaths = all.map((r) => normPath(r.from_path));
  const counts = new Map<string, number>();
  for (const p of fromPaths) counts.set(p, (counts.get(p) ?? 0) + 1);
  const duplicateFrom = [...counts.entries()].filter(([, n]) => n > 1).map(([p]) => p);

  const chain: {
    from_path: string;
    to_path: string;
    status_code: number;
    preserve_query: boolean;
  }[] = [];
  let cur = normPath(raw);
  const seen = new Set<string>();
  for (let i = 0; i < 16; i++) {
    if (seen.has(cur)) {
      return correlatedJson(cid, {
        data: { chain, loop: true, duplicate_from_warnings: [...new Set(duplicateFrom)] },
      });
    }
    seen.add(cur);
    const row = byFrom.get(cur);
    if (!row) {
      return correlatedJson(cid, {
        data: {
          chain,
          resolved: false,
          final_path: cur,
          duplicate_from_warnings: [...new Set(duplicateFrom)],
        },
      });
    }
    chain.push({
      from_path: row.from_path,
      to_path: row.to_path,
      status_code: row.status_code,
      preserve_query: row.preserve_query,
    });
    if (row.to_path.trim().startsWith("http")) {
      return correlatedJson(cid, {
        data: {
          chain,
          resolved: true,
          final_url: row.to_path.trim(),
          status_code: row.status_code,
          duplicate_from_warnings: [...new Set(duplicateFrom)],
        },
      });
    }
    cur = normPath(row.to_path);
  }
  return correlatedJson(cid, {
    data: { chain, loop: true, duplicate_from_warnings: [...new Set(duplicateFrom)] },
  });
}
