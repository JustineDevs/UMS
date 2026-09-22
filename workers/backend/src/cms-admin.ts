import type { WorkerDatabaseClient } from "./database.ts";
import { withWorkerTransaction } from "./database.ts";
import { lockCmsMediaReferences } from "./cms-media-references.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type CmsAdminEnv = {
  CMS_ADMIN_JWT_SECRET?: string;
  SUPABASE_URL?: string;
};

type CmsNode = {
  id: string;
  componentId: string;
  parentId: string | null;
  slot: string | null;
  props: Record<string, unknown>;
  styles: Record<string, string>;
  children: string[];
  variantId?: string;
  blockType?: string;
  lockedStructure?: boolean;
};

type CmsMutation = Record<string, unknown>;

type CmsPageInput = {
  id?: string;
  slug: string;
  locale?: string;
  page_type?: "static" | "landing" | "legal";
  title?: string;
  body?: string;
  blocks?: unknown[];
  tree?: unknown[];
  status?: "draft" | "published" | "scheduled";
  published_at?: string | null;
  scheduled_publish_at?: string | null;
  preview_token?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
  og_image_url?: string | null;
  json_ld?: unknown | null;
  parent_slug?: string | null;
  breadcrumb_label?: string | null;
  expectedVersion?: number;
  mutations?: CmsMutation[];
};

type CmsPageRow = Record<string, unknown>;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function boundedString(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length <= max ? value : null;
}

function parseNode(value: unknown, index: number): CmsNode | null {
  if (!isRecord(value)) return null;
  const id = boundedString(value.id, 160);
  const componentId = boundedString(value.componentId, 160);
  if (!id?.trim() || !componentId?.trim()) return null;
  const props = isRecord(value.props) ? value.props : {};
  const styles = isRecord(value.styles)
    ? Object.fromEntries(
        Object.entries(value.styles).filter(
          (entry): entry is [string, string] =>
            typeof entry[0] === "string" && typeof entry[1] === "string" && entry[0].length <= 100 && entry[1].length <= 2000,
        ),
      )
    : {};
  const children = Array.isArray(value.children)
    ? value.children.filter((child): child is string => typeof child === "string" && child.length <= 160)
    : [];
  return {
    id,
    componentId,
    parentId: typeof value.parentId === "string" && value.parentId.length <= 160 ? value.parentId : null,
    slot: typeof value.slot === "string" && value.slot.length <= 160 ? value.slot : null,
    props,
    styles,
    children,
    variantId: typeof value.variantId === "string" ? value.variantId : undefined,
    blockType: typeof value.blockType === "string" ? value.blockType : undefined,
    lockedStructure: typeof value.lockedStructure === "boolean" ? value.lockedStructure : undefined,
  };
}

function validateTree(value: unknown): { tree: CmsNode[]; errors: string[] } {
  if (!Array.isArray(value)) return { tree: [], errors: [] };
  if (value.length > 2000) return { tree: [], errors: ["tree_too_large"] };
  const tree = value.map(parseNode).filter((node): node is CmsNode => Boolean(node));
  if (tree.length !== value.length) return { tree: [], errors: ["invalid_tree_node"] };
  const byId = new Map(tree.map((node) => [node.id, node]));
  const errors: string[] = [];
  for (const node of tree) {
    if (byId.size !== tree.length) errors.push("duplicate_node_id");
    if (node.parentId && !byId.has(node.parentId)) errors.push(`orphan_parent:${node.id}`);
    const children = new Set<string>();
    for (const childId of node.children) {
      if (children.has(childId)) errors.push(`duplicate_child:${node.id}/${childId}`);
      children.add(childId);
      const child = byId.get(childId);
      if (!child) errors.push(`missing_child:${node.id}/${childId}`);
      else if (child.parentId !== node.id) errors.push(`parent_mismatch:${childId}`);
    }
  }
  return { tree, errors: [...new Set(errors)] };
}

function claimOrganization(claims: WorkerAuthClaims): string | null {
  const value = claims.organization_id ?? claims.org_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function canWrite(claims: WorkerAuthClaims): boolean {
  const permissions = claims.permissions;
  if (Array.isArray(permissions) && permissions.some((value) => value === "*" || value === "content:write")) return true;
  return claims.role === "owner" || claims.role === "admin";
}

function canRead(claims: WorkerAuthClaims): boolean {
  const permissions = claims.permissions;
  if (Array.isArray(permissions) && permissions.some((value) => value === "*" || value === "content:read" || value === "content:write")) return true;
  return claims.role === "owner" || claims.role === "admin";
}

async function listPages(database: WorkerDatabaseClient, organizationId: string, request: Request, pageId?: string): Promise<Response> {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale")?.trim();
  const slug = url.searchParams.get("slug")?.trim();
  if (locale && !/^[a-z]{2,12}(?:-[A-Z]{2})?$/.test(locale)) return json({ error: "invalid_locale" }, 400);
  if (slug && !/^[a-z0-9][a-z0-9/_-]{0,159}$/i.test(slug)) return json({ error: "invalid_slug" }, 400);
  const filters: string[] = ["organization_id = $1"];
  const values: unknown[] = [organizationId];
  if (pageId) { values.push(pageId); filters.push(`id = $${values.length}`); }
  if (locale) { values.push(locale); filters.push(`locale = $${values.length}`); }
  if (slug) { values.push(slug); filters.push(`slug = $${values.length}`); }
  const result = await database.query(
    `SELECT id, organization_id, slug, locale, page_type, title, body, blocks, tree, status, published_at, scheduled_publish_at, preview_token, meta_title, meta_description, canonical_url, og_image_url, json_ld, parent_slug, breadcrumb_label, version, updated_at FROM public.cms_pages WHERE ${filters.join(" AND ")} ORDER BY updated_at DESC LIMIT 500`,
    values,
  );
  if (pageId) return json({ data: result.rows[0] ?? null });
  return json({ data: result.rows });
}

async function deletePage(database: WorkerDatabaseClient, organizationId: string, pageId: string): Promise<Response> {
  return withWorkerTransaction(database, async (tx) => {
    await tx.query("DELETE FROM public.cms_pages WHERE organization_id = $1 AND id = $2", [organizationId, pageId]);
    return json({ ok: true });
  });
}

export async function handleCmsAdminPageMutationsRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: CmsAdminEnv,
  pageId: string,
): Promise<Response> {
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const organizationId = claimOrganization(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  if (!canRead(claims)) return json({ error: "forbidden" }, 403);
  if (!/^[0-9a-f-]{36}$/i.test(pageId)) return json({ error: "invalid_page_id" }, 400);
  const page = await database.query(
    "SELECT id FROM public.cms_pages WHERE id = $1 AND organization_id = $2 LIMIT 1",
    [pageId, organizationId],
  );
  if (!page.rows.length) return json({ error: "not_found" }, 404);
  const mutations = await database.query(
    "SELECT id, page_id, organization_id, revision, sequence, mutation, created_at FROM public.cms_page_mutations WHERE page_id = $1 AND organization_id = $2 ORDER BY revision DESC, sequence ASC LIMIT 1000",
    [pageId, organizationId],
  );
  return json({ data: mutations.rows });
}

async function readBody(request: Request): Promise<{ body: CmsPageInput | null; raw: string }> {
  const raw = await request.text();
  if (raw.length > 512 * 1024) return { body: null, raw };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { body: null, raw };
    if (typeof parsed.slug !== "string" || !/^[a-z0-9][a-z0-9/_-]{0,159}$/i.test(parsed.slug)) return { body: null, raw };
    if (parsed.locale !== undefined && (typeof parsed.locale !== "string" || !/^[a-z]{2,12}(?:-[A-Z]{2})?$/.test(parsed.locale))) return { body: null, raw };
    const expectedVersion = parsed.expectedVersion;
    if (expectedVersion !== undefined && (typeof expectedVersion !== "number" || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1)) return { body: null, raw };
    if (parsed.status !== undefined && !["draft", "published", "scheduled"].includes(String(parsed.status))) return { body: null, raw };
    if (parsed.tree !== undefined && !Array.isArray(parsed.tree)) return { body: null, raw };
    if (parsed.blocks !== undefined && !Array.isArray(parsed.blocks)) return { body: null, raw };
    if (parsed.mutations !== undefined && (!Array.isArray(parsed.mutations) || parsed.mutations.some((item) => !isRecord(item)))) return { body: null, raw };
    return { body: parsed as unknown as CmsPageInput, raw };
  } catch {
    return { body: null, raw };
  }
}

async function hash(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function savePage(
  database: WorkerDatabaseClient,
  organizationId: string,
  input: CmsPageInput,
): Promise<Response> {
  return withWorkerTransaction(database, async (tx) => {
    const existingResult = await tx.query<CmsPageRow>(
      `SELECT id, organization_id, slug, locale, page_type, title, body, blocks, tree, status, published_at, scheduled_publish_at, preview_token, meta_title, meta_description, canonical_url, og_image_url, json_ld, parent_slug, breadcrumb_label, version, updated_at FROM public.cms_pages WHERE organization_id = $1 AND ${input.id ? "id = $2" : "slug = $2 AND locale = $3"} FOR UPDATE`,
      input.id ? [organizationId, input.id] : [organizationId, input.slug, input.locale ?? "en"],
    );
    const existing = existingResult.rows[0];
    const currentVersion = existing ? Number(existing.version) : null;
    if (input.expectedVersion !== undefined && currentVersion !== input.expectedVersion) {
      return json({ error: "stale_version", version: currentVersion }, 409);
    }
    if (existing) {
      await tx.query(
        `INSERT INTO public.cms_page_versions (page_id, snapshot) VALUES ($1, $2::jsonb)`,
        [existing.id, JSON.stringify(existing)],
      );
    }
    const nextVersion = currentVersion === null ? 1 : currentVersion + 1;
    const sourceTree = input.tree ?? (Array.isArray(existing?.tree) ? existing.tree : []);
    const checked = validateTree(sourceTree);
    if (input.status === "published" && checked.errors.length) return json({ error: "invalid_publish_tree", details: checked.errors }, 422);
    const tree = checked.tree;
    const values = [
      organizationId,
      input.slug,
      input.locale ?? String(existing?.locale ?? "en"),
      input.page_type ?? String(existing?.page_type ?? "static"),
      input.title ?? String(existing?.title ?? ""),
      input.body ?? String(existing?.body ?? ""),
      JSON.stringify(input.blocks ?? existing?.blocks ?? []),
      JSON.stringify(tree),
      input.status ?? String(existing?.status ?? "draft"),
      input.published_at !== undefined ? input.published_at : existing?.published_at ?? null,
      input.scheduled_publish_at !== undefined ? input.scheduled_publish_at : existing?.scheduled_publish_at ?? null,
      input.preview_token !== undefined ? input.preview_token : existing?.preview_token ?? null,
      input.meta_title !== undefined ? input.meta_title : existing?.meta_title ?? null,
      input.meta_description !== undefined ? input.meta_description : existing?.meta_description ?? null,
      input.canonical_url !== undefined ? input.canonical_url : existing?.canonical_url ?? null,
      input.og_image_url !== undefined ? input.og_image_url : existing?.og_image_url ?? null,
      input.json_ld !== undefined ? JSON.stringify(input.json_ld) : JSON.stringify(existing?.json_ld ?? null),
      input.parent_slug !== undefined ? input.parent_slug : existing?.parent_slug ?? null,
      input.breadcrumb_label !== undefined ? input.breadcrumb_label : existing?.breadcrumb_label ?? null,
      nextVersion,
    ];
    if (!await lockCmsMediaReferences(tx, organizationId, values)) {
      return json({ error: "media_reference_deleted" }, 409);
    }
    const result = existing
      ? await tx.query<CmsPageRow>(
          `UPDATE public.cms_pages SET slug=$2, locale=$3, page_type=$4, title=$5, body=$6, blocks=$7::jsonb, tree=$8::jsonb, status=$9, published_at=$10, scheduled_publish_at=$11, preview_token=$12, meta_title=$13, meta_description=$14, canonical_url=$15, og_image_url=$16, json_ld=$17::jsonb, parent_slug=$18, breadcrumb_label=$19, version=$20, updated_at=now() WHERE organization_id=$1 AND id=$21 AND version=$22 RETURNING *`,
          [...values, existing.id, currentVersion],
        )
      : await tx.query<CmsPageRow>(
          `INSERT INTO public.cms_pages (organization_id, slug, locale, page_type, title, body, blocks, tree, status, published_at, scheduled_publish_at, preview_token, meta_title, meta_description, canonical_url, og_image_url, json_ld, parent_slug, breadcrumb_label, version) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20) RETURNING *`,
          values,
        );
    if (result.rows.length !== 1) return json({ error: "page_write_conflict" }, 409);
    const page = result.rows[0];
    if (input.mutations?.length) {
      await tx.query(
        `INSERT INTO public.cms_page_mutations (page_id, organization_id, revision, sequence, mutation) SELECT $1, $2, $3, value::int, mutation::jsonb FROM jsonb_array_elements($4::jsonb) WITH ORDINALITY AS rows(mutation, value)`,
        [page.id, organizationId, nextVersion, JSON.stringify(input.mutations)],
      );
    }
    return json({ data: page }, 200);
  });
}

export async function handleCmsAdminPageRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: CmsAdminEnv,
  pageId?: string,
): Promise<Response> {
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const organizationId = claimOrganization(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  if (request.method === "GET") {
    if (!canRead(claims)) return json({ error: "forbidden" }, 403);
    const response = await listPages(database, organizationId, request, pageId);
    if (pageId && response.status === 200) {
      const payload = await response.clone().json() as { data?: unknown };
      if (!payload.data) return json({ error: "not_found" }, 404);
    }
    return response;
  }
  if (request.method === "DELETE") {
    if (!pageId || !canWrite(claims)) return json({ error: "forbidden" }, 403);
    const key = request.headers.get("Idempotency-Key")?.trim();
    if (!key) return json({ error: "idempotency_key_required" }, 400);
    const result = await executeIdempotently(
      new HyperdriveIdempotencyStore(database),
      key,
      await hash(`${organizationId}:${pageId}:delete`),
      () => deletePage(database, organizationId, pageId),
    );
    return result.response;
  }
  if (request.method !== "POST" && request.method !== "PUT") return json({ error: "method_not_allowed" }, 405);
  if (!canWrite(claims)) return json({ error: "forbidden" }, 403);
  const parsed = await readBody(request);
  if (parsed.raw.length > 512 * 1024) return json({ error: "payload_too_large" }, 413);
  if (!parsed.body || (pageId && parsed.body.id && parsed.body.id !== pageId)) return json({ error: "invalid_page_payload" }, 400);
  const input = pageId ? { ...parsed.body, id: pageId } : parsed.body;
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key) return json({ error: "idempotency_key_required" }, 400);
  const result = await executeIdempotently(
    new HyperdriveIdempotencyStore(database),
    key,
    await hash(parsed.raw),
    () => savePage(database, organizationId, input),
  );
  return result.response;
}
