import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveCatalogMediaReferences(
  supabase: SupabaseClient,
  mediaIds: readonly string[],
  organizationId: string,
): Promise<string[]> {
  const ids = [...new Set(mediaIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("cms_media")
    .select("id,public_url")
    .in("id", ids)
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  if (error) throw new Error("Unable to validate catalog media references");
  const urls = new Map(
    (data ?? [])
      .filter((row) => typeof row.public_url === "string" && row.public_url.trim())
      .map((row) => [String(row.id), String(row.public_url).trim()]),
  );
  if (urls.size !== ids.length) {
    throw new Error("One or more catalog media references are unavailable");
  }
  return ids.map((id) => urls.get(id) as string);
}

/**
 * Collects absolute media URL strings from a catalog product create/update JSON body
 * so they can be mirrored into `cms_media` (see `ensureExternalCatalogProductMediaRows`).
 */
export function collectCatalogMediaUrlsFromBody(body: Record<string, unknown>): string[] {
  const urls: string[] = [];

  const images = body.imageUrls;
  if (Array.isArray(images)) {
    for (const x of images) {
      if (typeof x === "string" && x.trim()) urls.push(x.trim());
    }
  }

  const thumb = body.thumbnail;
  if (typeof thumb === "string" && thumb.trim()) urls.push(thumb.trim());

  const sm = body.storefrontMetadata;
  if (sm != null && typeof sm === "object" && !Array.isArray(sm)) {
    const o = sm as Record<string, unknown>;
    const videoUrl = o.videoUrl;
    if (typeof videoUrl === "string" && videoUrl.trim()) urls.push(videoUrl.trim());

    const gallery = o.galleryVideoUrlsText;
    if (typeof gallery === "string" && gallery.trim()) {
      for (const line of gallery.split(/\r?\n/)) {
        const t = line.trim();
        if (t) urls.push(t);
      }
    }

    const life = o.lifestyleImageUrl;
    if (typeof life === "string" && life.trim()) urls.push(life.trim());
  }

  return urls;
}
