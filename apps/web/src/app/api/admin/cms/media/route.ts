import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import {
  CMS_MEDIA_TAG_CATALOG_PRODUCT,
  insertCmsMedia,
  listCmsMedia,
  type ListCmsMediaOptions,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSessionAny } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";

const MAX_CMS_MEDIA_BODY_BYTES = 25 * 1024 * 1024 + 256 * 1024;

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSessionAny([
    "content:read",
    "catalog:read",
    "catalog:write",
  ]);
  if (!auth.ok) return auth.response;
  const canContentRead = auth.permission === "content:read";
  const canCatalogList = auth.permission !== "content:read";
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is required" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const opts: ListCmsMediaOptions = {
    limit: Math.min(Number(sp.get("limit")) || 200, 500),
    search: sp.get("q") ?? undefined,
    mimePrefix: sp.get("mime") ?? undefined,
    sort: (sp.get("sort") as ListCmsMediaOptions["sort"]) || "created_desc",
    tag: sp.get("tag") ?? undefined,
    organizationId: organization.id,
  };
  if (!canContentRead && canCatalogList) {
    opts.tag = CMS_MEDIA_TAG_CATALOG_PRODUCT;
  }
  const data = await listCmsMedia(sup.client, opts);
  return correlatedJson(cid, { data });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSessionAny(["content:write", "catalog:write"]);
  if (!auth.ok) return auth.response;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is required" }, { status: 403 });
  const sb = sup.client;

  const contentLength = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(contentLength) && contentLength > MAX_CMS_MEDIA_BODY_BYTES) {
    return correlatedJson(cid, { error: "Upload is too large" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return correlatedJson(cid, { error: "Invalid form data" }, { status: 400 });
  }
  const file = form.get("file");
  const altText = typeof form.get("alt") === "string" ? (form.get("alt") as string) : "";
  if (!(file instanceof Blob) || file.size === 0) {
    return correlatedJson(cid, { error: "Missing file" }, { status: 400 });
  }
  const mime = (file as File).type || "";
  const extensionAllowed = /\.(png|jpe?g|gif|webp|avif|svg|bmp|mp4|webm|mov|ogg)$/i.test(
    typeof (file as File).name === "string" ? (file as File).name : "",
  );
  if (!(mime.startsWith("image/") || mime.startsWith("video/")) && !extensionAllowed) {
    return correlatedJson(cid, { error: "Only image or video uploads are allowed" }, { status: 400 });
  }
  if (mime.startsWith("image/") && altText.trim().length === 0) {
    return correlatedJson(
      cid,
      { error: "Alt text is required for image uploads" },
      { status: 400 },
    );
  }
  const MAX_BYTES = 25 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return correlatedJson(
      cid,
      { error: `File exceeds limit of ${MAX_BYTES} bytes` },
      { status: 400 },
    );
  }

  const rawName = typeof (file as File).name === "string" ? (file as File).name : "upload";
  const safe = rawName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  const path = `public/${crypto.randomUUID()}-${safe}`;

  const ab = await file.arrayBuffer();
  const { error: upErr } = await sb.storage.from("cms").upload(path, ab, {
    contentType: (file as File).type || "application/octet-stream",
    upsert: false,
  });
  if (upErr) {
    return correlatedJson(cid, { error: upErr.message }, { status: 500 });
  }

  const { data: pub } = sb.storage.from("cms").getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const row = await insertCmsMedia(sb, {
    storage_path: path,
    public_url: publicUrl,
    alt_text: altText || null,
    mime_type: (file as File).type || null,
    width: null,
    height: null,
    display_name: safe,
    byte_size: file.size,
    organization_id: organization.id,
  });
  if (!row) {
    await sb.storage.from("cms").remove([path]).catch(() => undefined);
    return correlatedJson(cid, { error: "Unable to save metadata" }, { status: 500 });
  }
  return correlatedJson(cid, { data: row });
}

export const POST = withAdminMutationIdempotency("/admin/cms/media:POST", post);
