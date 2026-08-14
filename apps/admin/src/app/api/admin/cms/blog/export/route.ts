import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { insertStaffAuditLog } from "@/lib/staff-audit";

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
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
  const rawIds = req.nextUrl.searchParams.get("ids");
  const ids = rawIds
    ?.split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (
    ids &&
    (ids.length > 100 || ids.some((id) => !/^[0-9a-f-]{36}$/i.test(id)))
  ) {
    return new Response("Invalid ids", { status: 400 });
  }
  let query = sup.client
    .from("cms_blog_posts")
    .select(
      "id,slug,locale,title,status,published_at,scheduled_publish_at,author_name,tags,rss_include,canonical_url,og_image_url,updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(1000);
  if (ids?.length) query = query.in("id", ids);
  query = query.eq("organization_id", organization.id);
  const { data, error } = await query;
  if (error)
    return new Response("Unable to export blog posts", { status: 502 });
  const filtered = (data ?? []) as Array<Record<string, unknown>>;

  const header = [
    "id",
    "slug",
    "locale",
    "title",
    "status",
    "published_at",
    "scheduled_publish_at",
    "author_name",
    "tags",
    "rss_include",
    "canonical_url",
    "og_image_url",
    "updated_at",
  ];
  const lines = [
    header.join(","),
    ...filtered.map((r) =>
      [
        r.id,
        r.slug,
        r.locale,
        r.title,
        r.status,
        r.published_at ?? "",
        r.scheduled_publish_at ?? "",
        r.author_name ?? "",
        Array.isArray(r.tags) ? r.tags.map(String).join(";") : "",
        r.rss_include === true ? "1" : "0",
        r.canonical_url ?? "",
        r.og_image_url ?? "",
        r.updated_at,
      ]
        .map((c) => csvEscape(String(c)))
        .join(","),
    ),
  ];
  const body = lines.join("\r\n");
  if (new TextEncoder().encode(body).byteLength > 5 * 1024 * 1024) {
    return new Response("Export too large", { status: 413 });
  }
  await insertStaffAuditLog(sup.client, {
    actorEmail: session.user.email ?? "unknown",
    action: "cms.blog.export",
    resource: "cms_blog_posts",
    details: {
      organization_id: organization.id,
      count: filtered.length,
      correlation_id: cid,
    },
  });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="blog-posts.csv"',
    },
  });
}
