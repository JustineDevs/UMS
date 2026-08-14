import type { CmsMediaReferenceHit } from "@universal-music-store/platform-data";
import { medusaAdminFetch } from "./medusa-admin-http";
import { getMedusaAdminProductEditUrl } from "./medusa-catalog-bridge";
import { getMedusaSecretKey } from "./medusa-pos";

function blobContainsUrl(product: unknown, needle: string): boolean {
  const n = needle.trim();
  if (!n) return false;
  try {
    const s = JSON.stringify(product);
    if (s.includes(n)) return true;
    const enc = encodeURIComponent(n);
    if (enc !== n && s.includes(enc)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Scans Medusa admin products (paginated) for JSON blobs containing the media public URL.
 * Server-only; returns empty when Medusa admin key is not configured.
 */
export async function findMedusaProductMediaReferences(
  publicUrl: string,
): Promise<CmsMediaReferenceHit[]> {
  if (!getMedusaSecretKey()) return [];

  const needle = publicUrl.trim();
  if (!needle) return [];

  const hits: CmsMediaReferenceHit[] = [];
  const limit = 50;
  let offset = 0;
  const maxPages = 100;

  for (let page = 0; page < maxPages; page++) {
    const qs = new URLSearchParams();
    qs.set("limit", String(limit));
    qs.set("offset", String(offset));
    qs.set("fields", "id,title,handle,thumbnail,images,metadata");

    let res: Response;
    try {
      res = await medusaAdminFetch(`/admin/products?${qs.toString()}`);
    } catch {
      break;
    }
    if (!res.ok) break;

    const json = (await res.json()) as { products?: unknown[] };
    const products = json.products ?? [];
    if (!products.length) break;

    for (const p of products) {
      if (!blobContainsUrl(p, needle)) continue;
      const o = p as Record<string, unknown>;
      const id = String(o.id ?? "");
      const title = String(o.title ?? "").trim() || id;
      const adminUrl = getMedusaAdminProductEditUrl(id);
      hits.push({
        source: "medusa_product",
        detail: `${title} (${id}) — ${adminUrl}`,
      });
    }

    offset += products.length;
    if (products.length < limit) break;
  }

  return hits;
}
