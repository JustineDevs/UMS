import type { WorkerDatabaseClient } from "./database.ts";
import { withWorkerTransaction } from "./database.ts";
import { lockCmsMediaReferences } from "./cms-media-references.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type NavigationAdminEnv = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
type Link = { href: string; label: string; [key: string]: unknown };
type NavigationPayload = {
  headerLinks: Link[];
  headerLinksMobile: Link[];
  footerColumns: Array<{ title: string; links: Link[] }>;
  footerBottomLinks: Link[];
  socialLinks: Link[];
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function claimOrganization(claims: WorkerAuthClaims): string | null {
  const value = claims.organization_id ?? claims.org_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function canWrite(claims: WorkerAuthClaims, publish: boolean): boolean {
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  return permissions.some((value) => value === "*" || value === "content:write" || (publish && value === "content:publish")) || claims.role === "owner" || claims.role === "admin";
}
function canRead(claims: WorkerAuthClaims): boolean {
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  return permissions.some((value) => value === "*" || value === "content:read" || value === "content:write") || claims.role === "owner" || claims.role === "admin";
}
function safeHref(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000 || !value.trim()) return null;
  try {
    const url = new URL(value, "https://storefront.invalid");
    if (!["http:", "https:"].includes(url.protocol) && !value.startsWith("/")) return null;
  } catch { return null; }
  return value;
}
function parseLink(value: unknown, depth = 0): Link | null {
  if (depth > 4 || !isRecord(value)) return null;
  const href = safeHref(value.href);
  if (!href || typeof value.label !== "string" || value.label.length > 200 || !value.label.trim()) return null;
  const link: Link = { href, label: value.label.trim() };
  for (const key of ["badge", "iconKey", "startsAt", "endsAt"] as const) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== "string" || String(value[key]).length > 200) return null;
      link[key] = value[key];
    }
  }
  if (value.featured !== undefined) {
    if (!isRecord(value.featured) || !safeHref(value.featured.href) || typeof value.featured.label !== "string") return null;
    link.featured = { href: value.featured.href, label: value.featured.label };
  }
  if (value.children !== undefined) {
    if (!Array.isArray(value.children) || value.children.length > 100) return null;
    const children = value.children.map((child) => parseLink(child, depth + 1));
    if (children.some((child) => child === null)) return null;
    link.children = children;
  }
  return link;
}
function parseLinks(value: unknown): Link[] | null {
  if (!Array.isArray(value) || value.length > 200) return null;
  const links = value.map((item) => parseLink(item));
  return links.some((link) => link === null) ? null : links as Link[];
}
function parsePayload(value: unknown): NavigationPayload | null {
  if (!isRecord(value)) return null;
  const headerLinks = parseLinks(value.headerLinks);
  const headerLinksMobile = parseLinks(value.headerLinksMobile);
  const footerBottomLinks = parseLinks(value.footerBottomLinks);
  if (!headerLinks || !headerLinksMobile || !footerBottomLinks || !Array.isArray(value.footerColumns) || value.footerColumns.length > 50 || !Array.isArray(value.socialLinks)) return null;
  const footerColumns = value.footerColumns.map((column) => {
    if (!isRecord(column) || typeof column.title !== "string" || column.title.length > 200) return null;
    const links = parseLinks(column.links);
    return links ? { title: column.title, links } : null;
  });
  const socialLinks = parseLinks(value.socialLinks);
  if (footerColumns.some((column) => column === null) || !socialLinks) return null;
  return { headerLinks, headerLinksMobile, footerColumns: footerColumns as Array<{ title: string; links: Link[] }>, footerBottomLinks, socialLinks };
}
async function body(request: Request): Promise<{ raw: string; value: Record<string, unknown> | null }> {
  const raw = await request.text();
  if (raw.length > 128 * 1024) return { raw, value: null };
  try { const value: unknown = JSON.parse(raw); return { raw, value: isRecord(value) ? value : null }; } catch { return { raw, value: null }; }
}
async function digest(raw: string): Promise<string> {
  const value = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function emptyPayload(): NavigationPayload { return { headerLinks: [], headerLinksMobile: [], footerColumns: [], footerBottomLinks: [], socialLinks: [] }; }

async function readNavigation(database: WorkerDatabaseClient, organizationId: string): Promise<Response> {
  const liveResult = await database.query(
    "SELECT header_links, header_links_mobile, footer_columns, footer_bottom_links, social_links FROM public.cms_navigation WHERE id = 'default' AND organization_id = $1 LIMIT 1",
    [organizationId],
  );
  const liveRow = liveResult.rows[0];
  const live = liveRow ? parsePayload({
    headerLinks: liveRow.header_links,
    headerLinksMobile: liveRow.header_links_mobile,
    footerColumns: liveRow.footer_columns,
    footerBottomLinks: liveRow.footer_bottom_links,
    socialLinks: liveRow.social_links,
  }) ?? emptyPayload() : emptyPayload();
  const draftResult = await database.query<{ payload?: unknown }>(
    "SELECT payload FROM public.cms_navigation_draft WHERE id = 'default' AND organization_id = $1 LIMIT 1",
    [organizationId],
  );
  const rawDraft = draftResult.rows[0]?.payload;
  const draft = isRecord(rawDraft) && Object.keys(rawDraft).length > 0 ? rawDraft : null;
  const merged = draft ? parsePayload({ ...live, ...draft }) ?? live : live;
  return json({ data: merged, meta: { hasDraft: Boolean(draft) } });
}

async function saveNavigation(database: WorkerDatabaseClient, organizationId: string, payload: NavigationPayload, mode: "draft" | "live"): Promise<Response> {
  return withWorkerTransaction(database, async (tx) => {
    if (!await lockCmsMediaReferences(tx, organizationId, payload)) return json({ error: "media_reference_deleted" }, 409);
    if (mode === "draft") {
      await tx.query(`INSERT INTO public.cms_navigation_draft (id, organization_id, payload, updated_at) VALUES ('default', $1, $2::jsonb, now()) ON CONFLICT (organization_id, id) DO UPDATE SET payload=EXCLUDED.payload, updated_at=now()`, [organizationId, JSON.stringify(payload)]);
    } else {
      await tx.query(`INSERT INTO public.cms_navigation (id, organization_id, header_links, header_links_mobile, footer_columns, footer_bottom_links, social_links, updated_at) VALUES ('default', $1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, now()) ON CONFLICT (organization_id, id) DO UPDATE SET header_links=EXCLUDED.header_links, header_links_mobile=EXCLUDED.header_links_mobile, footer_columns=EXCLUDED.footer_columns, footer_bottom_links=EXCLUDED.footer_bottom_links, social_links=EXCLUDED.social_links, updated_at=now()`, [organizationId, JSON.stringify(payload.headerLinks), JSON.stringify(payload.headerLinksMobile), JSON.stringify(payload.footerColumns), JSON.stringify(payload.footerBottomLinks), JSON.stringify(payload.socialLinks)]);
      await tx.query(`INSERT INTO public.cms_navigation_draft (id, organization_id, payload, updated_at) VALUES ('default', $1, '{}'::jsonb, now()) ON CONFLICT (organization_id, id) DO UPDATE SET payload='{}'::jsonb, updated_at=now()`, [organizationId]);
    }
    return json({ data: payload, meta: { hasDraft: mode === "draft" } });
  });
}

export async function handleCmsAdminNavigationRequest(request: Request, database: WorkerDatabaseClient, env: NavigationAdminEnv, publish = false): Promise<Response> {
  if (request.method === "GET" && !publish) {
    const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
    if (!claims) return json({ error: "unauthorized" }, 401);
    if (!canRead(claims)) return json({ error: "forbidden" }, 403);
    const organizationId = claimOrganization(claims);
    if (!organizationId) return json({ error: "organization_claim_required" }, 403);
    return readNavigation(database, organizationId);
  }
  const requiredMethod = publish ? "POST" : "PUT";
  if (request.method !== requiredMethod) return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!canWrite(claims, publish)) return json({ error: "forbidden" }, 403);
  const organizationId = claimOrganization(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  const parsed = await body(request);
  if (parsed.raw.length > 128 * 1024 || (!publish && !parsed.value)) return json({ error: "invalid_navigation_payload" }, parsed.raw.length > 128 * 1024 ? 413 : 400);
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key) return json({ error: "idempotency_key_required" }, 400);
  let rawForReplay = parsed.raw;
  let payload: NavigationPayload | null = null;
  if (publish && !parsed.value) {
    const draft = await database.query<{ payload?: unknown }>("SELECT payload FROM public.cms_navigation_draft WHERE id = 'default' AND organization_id = $1 LIMIT 1", [organizationId]);
    payload = parsePayload(draft.rows[0]?.payload);
    rawForReplay = `publish:${organizationId}`;
  } else {
    const value = parsed.value as Record<string, unknown>;
    const mode = value.mode === "draft" ? "draft" : "live";
    const source = mode === "draft" && isRecord(value.payload) ? value.payload : value;
    payload = parsePayload(source);
  }
  if (!payload) return json({ error: "invalid_navigation_payload" }, 400);
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), key, await digest(rawForReplay), () => saveNavigation(database, organizationId, payload as NavigationPayload, publish ? "live" : (parsed.value as Record<string, unknown>).mode === "draft" ? "draft" : "live"))).response;
}

export function navigationPayloadForTest(): NavigationPayload { return emptyPayload(); }
