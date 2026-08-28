import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import {
  CMS_MEDIA_TAG_CATALOG_PRODUCT,
  insertCmsMedia,
  listCmsMedia,
  ensureExternalCatalogProductMediaRows,
  type ListCmsMediaOptions,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import {
  requireStaffApiSession,
  requireStaffApiSessionAny,
} from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { medusaAdminFetch } from "@/lib/medusa-admin-http";
import { catalogMediaUrlsFromProducts } from "@/lib/catalog-media-urls";

const BUCKET = "catalog";
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_CATALOG_MEDIA_BODY_BYTES = MAX_VIDEO_BYTES + 256 * 1024;
const MEDUSA_PRODUCT_PAGE_SIZE = 100;
const MEDUSA_PRODUCT_MAX_PAGES = 100;

function safeSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128);
}

function guessVideoMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".ogg")) return "video/ogg";
  return "video/mp4";
}

/** Lists `cms_media` rows tagged for the catalog bucket (same rows as CMS media library, scoped). */
export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSessionAny(["catalog:read", "catalog:write"]);
  if (!auth.ok) return auth.response;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is required" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  let catalogSourceUnavailable = false;
  try {
    const urls = new Set<string>();
    for (let page = 0; page < MEDUSA_PRODUCT_MAX_PAGES; page += 1) {
      const params = new URLSearchParams({
        limit: String(MEDUSA_PRODUCT_PAGE_SIZE),
        offset: String(page * MEDUSA_PRODUCT_PAGE_SIZE),
        fields: "id,title,thumbnail,*images",
      });
      const productsRes = await medusaAdminFetch(`/admin/products?${params}`, {
        method: "GET",
      });
      if (!productsRes.ok) {
        catalogSourceUnavailable = true;
        break;
      }
      const body = (await productsRes.json()) as { products?: unknown[] };
      const products = Array.isArray(body.products) ? body.products : [];
      for (const url of catalogMediaUrlsFromProducts(products)) urls.add(url);
      if (products.length < MEDUSA_PRODUCT_PAGE_SIZE) break;
    }
    if (!catalogSourceUnavailable) {
      await ensureExternalCatalogProductMediaRows(sup.client, [...urls], organization.id);
    }
  } catch {
    catalogSourceUnavailable = true;
  }
  const opts: ListCmsMediaOptions = {
    limit: Math.min(Number(sp.get("limit")) || 200, 500),
    search: sp.get("q") ?? undefined,
    mimePrefix: sp.get("mime") ?? undefined,
    sort: (sp.get("sort") as ListCmsMediaOptions["sort"]) || "created_desc",
    tag: CMS_MEDIA_TAG_CATALOG_PRODUCT,
    organizationId: organization.id,
  };
  const data = await listCmsMedia(sup.client, opts);
  return correlatedJson(cid, {
    data,
    catalogSourceUnavailable,
    // The browser session can hydrate after this request (and local auth has
    // no NextAuth cookie), so expose the server's already-authorized result.
    canWrite: staffSessionAllows(auth.session, "catalog:write"),
  });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSession("catalog:write");
  if (!auth.ok) return auth.response;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is required" }, { status: 403 });
  const sb = sup.client;

  const contentLength = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(contentLength) && contentLength > MAX_CATALOG_MEDIA_BODY_BYTES) {
    return correlatedJson(cid, { error: "Upload is too large" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return correlatedJson(cid, { error: "Invalid form data" }, { status: 400 });
  }
  const file = form.get("file");
  const altRaw = typeof form.get("alt") === "string" ? form.get("alt") : "";
  const altText = typeof altRaw === "string" ? altRaw.trim() : "";
  const productIdRaw =
    typeof form.get("productId") === "string" ? form.get("productId") : "";
  const productId =
    typeof productIdRaw === "string" ? safeSegment(productIdRaw.trim()) : "";

  if (!(file instanceof Blob) || file.size === 0) {
    return correlatedJson(cid, { error: "Missing file" }, { status: 400 });
  }

  const rawName = typeof (file as File).name === "string" ? (file as File).name : "upload";
  const mime = (file as File).type || "";
  const videoExtOk = /\.(mp4|webm|mov|ogg)$/i.test(rawName);
  const isImage = mime.startsWith("image/");
  const isVideo =
    mime.startsWith("video/") ||
    ((mime === "" || mime === "application/octet-stream") && videoExtOk);

  if (!isImage && !isVideo) {
    return correlatedJson(
      cid,
      { error: "Only image or video uploads are allowed" },
      { status: 400 },
    );
  }

  if (isVideo) {
    const allowed = new Set([
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/ogg",
    ]);
    const looseVideo = !mime || mime === "application/octet-stream";
    if (looseVideo && !videoExtOk) {
      return correlatedJson(
        cid,
        { error: "Could not detect video type. Use a .mp4, .webm, .mov, or .ogg file." },
        { status: 400 },
      );
    }
    if (!looseVideo && !allowed.has(mime)) {
      return correlatedJson(
        cid,
        { error: "Unsupported video type. Use mp4, webm, mov, or ogg." },
        { status: 400 },
      );
    }
  }

  const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > maxBytes) {
    return correlatedJson(
      cid,
      { error: `File exceeds limit of ${maxBytes} bytes` },
      { status: 400 },
    );
  }
  const safe = rawName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  const stem = safe.replace(/\.[^.]+$/, "") || "file";
  const prefix = productId ? `products/${productId}` : "public";
  const path = `${prefix}/${crypto.randomUUID()}-${safe}`;

  const declaredType = (file as File).type?.trim();
  const resolvedContentType =
    declaredType && declaredType !== "application/octet-stream"
      ? declaredType
      : isVideo
        ? guessVideoMimeFromName(rawName)
        : "application/octet-stream";

  const ab = await file.arrayBuffer();
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, ab, {
    contentType: resolvedContentType,
    upsert: false,
  });
  if (upErr) {
    return correlatedJson(cid, { error: upErr.message }, { status: 500 });
  }

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const altResolved = isImage
    ? altText || `Product image: ${stem}`
    : null;

  const row = await insertCmsMedia(sb, {
    storage_path: path,
    public_url: publicUrl,
    alt_text: altResolved,
    mime_type: declaredType || (isVideo ? guessVideoMimeFromName(rawName) : null),
    width: null,
    height: null,
    display_name: safe,
    byte_size: file.size,
    tags: [CMS_MEDIA_TAG_CATALOG_PRODUCT],
    organization_id: organization.id,
  });
  if (!row) {
    await sb.storage.from(BUCKET).remove([path]).catch(() => undefined);
    return correlatedJson(cid, { error: "Unable to save metadata" }, { status: 500 });
  }
  return correlatedJson(cid, { data: row });
}

export const POST = withAdminMutationIdempotency("/admin/catalog/media:POST", post);
