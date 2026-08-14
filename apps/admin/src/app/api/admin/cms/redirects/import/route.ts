import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { upsertCmsRedirect } from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { insertStaffAuditLog } from "@/lib/staff-audit";

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "content:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 1_048_576) {
    return correlatedJson(cid, { error: "CSV too large" }, { status: 413 });
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > 1_048_576) {
    return correlatedJson(cid, { error: "CSV too large" }, { status: 413 });
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (
    lines.length < 2 ||
    lines.length > 1001 ||
    lines.some((line) => line.length > 16_384)
  ) {
    return correlatedJson(
      cid,
      { error: "CSV must include header and one row" },
      { status: 400 },
    );
  }
  const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const fi = header.indexOf("from_path");
  const ti = header.indexOf("to_path");
  const si = header.indexOf("status_code");
  const ai = header.indexOf("active");
  const pi = header.indexOf("preserve_query");
  if (fi < 0 || ti < 0) {
    return correlatedJson(
      cid,
      { error: "CSV must include from_path and to_path columns" },
      { status: 400 },
    );
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(
    sup.client,
    session.user.email,
  );
  if (!organization)
    return correlatedJson(
      cid,
      { error: "Tenant scope unavailable" },
      { status: 403 },
    );
  const warnings: string[] = [];
  let imported = 0;
  for (let r = 1; r < lines.length; r++) {
    const cols = parseCsvLine(lines[r]!);
    const from_path = cols[fi]?.trim() ?? "";
    const to_path = cols[ti]?.trim() ?? "";
    if (
      !from_path ||
      !to_path ||
      from_path.length > 2048 ||
      to_path.length > 2048 ||
      /[\u0000-\u001f\u007f]/.test(`${from_path}${to_path}`)
    ) {
      warnings.push(`Row ${r + 1}: skipped (empty path)`);
      continue;
    }
    const normalizedFrom = from_path.startsWith("/")
      ? from_path
      : `/${from_path}`;
    if (
      normalizedFrom.startsWith("//") ||
      !to_path.startsWith("/") ||
      to_path.startsWith("//")
    ) {
      warnings.push(`Row ${r + 1}: skipped (paths must be local)`);
      continue;
    }
    const parsedStatus = si < 0 || !cols[si]?.trim() ? 301 : Number(cols[si]);
    if (![301, 302, 307, 308].includes(parsedStatus)) {
      warnings.push(`Row ${r + 1}: skipped (invalid status code)`);
      continue;
    }
    const status_code = parsedStatus as 301 | 302 | 307 | 308;
    const active =
      ai < 0 ? true : cols[ai] === "1" || cols[ai]?.toLowerCase() === "true";
    const preserve_query =
      pi < 0 ? false : cols[pi] === "1" || cols[pi]?.toLowerCase() === "true";
    const { data: hit } = await sup.client
      .from("cms_redirects")
      .select("id")
      .eq("from_path", normalizedFrom)
      .maybeSingle();
    const existingId = hit ? String((hit as { id?: string }).id ?? "") : "";
    const row = await upsertCmsRedirect(sup.client, {
      id: existingId || undefined,
      from_path: normalizedFrom,
      to_path,
      status_code,
      active,
      preserve_query,
    });
    if (!row) warnings.push(`Row ${r + 1}: could not save ${normalizedFrom}`);
    else imported++;
  }
  await insertStaffAuditLog(sup.client, {
    actorEmail: session.user.email ?? "unknown",
    action: "cms.redirects.import",
    resource: "cms_redirects",
    details: {
      organization_id: organization.id,
      imported,
      warning_count: warnings.length,
      correlation_id: cid,
    },
  });
  return correlatedJson(cid, {
    data: { imported, warnings: warnings.slice(0, 100) },
  });
}

export const POST = withAdminMutationIdempotency("/admin/cms/redirects/import:POST", post);
