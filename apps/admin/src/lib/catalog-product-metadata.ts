/**
 * Medusa product.metadata keys aligned with storefront {@link mapMedusaProductToProduct}.
 */

export type CatalogProductMetadataFields = {
  /** Canonical private-media references; URLs remain a compatibility projection. */
  mediaIds: string[];
  brand: string | null;
  videoUrl: string | null;
  /** Extra carousel video URLs (one per line); stored as metadata `gallery_video_urls`. */
  galleryVideoUrlsText: string;
  weightKg: number | null;
  dimensionsLabel: string | null;
  material: string | null;
  lifestyleImageUrl: string | null;
  seoDescription: string | null;
  /** Comma- or newline-separated product handles. */
  relatedHandlesText: string;
  /** JSON array string for hotspots, same shape as storefront parser. */
  hotspotsJson: string;
  guitarSpecsJson: string;
  audioDemosJson: string;
  trustContentJson: string;
};

export const EMPTY_CATALOG_METADATA_FIELDS: CatalogProductMetadataFields = {
  mediaIds: [],
  brand: null,
  videoUrl: null,
  galleryVideoUrlsText: "",
  weightKg: null,
  dimensionsLabel: null,
  material: null,
  lifestyleImageUrl: null,
  seoDescription: null,
  relatedHandlesText: "",
  hotspotsJson: "",
  guitarSpecsJson: "",
  audioDemosJson: "",
  trustContentJson: "",
};

function strOrNull(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length ? t : null;
}

function numOrNull(n: unknown): number | null {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (typeof n === "string" && n.trim()) {
    const v = Number(n);
    if (Number.isFinite(v)) return v;
  }
  return null;
}

export function catalogMetadataFromMedusa(
  meta: Record<string, unknown> | null | undefined,
): CatalogProductMetadataFields {
  if (!meta || typeof meta !== "object") {
    return { ...EMPTY_CATALOG_METADATA_FIELDS };
  }
  const m = meta;
  const rawRelated = m.related_handles ?? m.relatedHandles;
  let relatedText = "";
  if (Array.isArray(rawRelated)) {
    relatedText = rawRelated
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .join(", ");
  } else if (typeof rawRelated === "string") {
    relatedText = rawRelated.trim();
  }
  const hotspotsRaw = m.hotspots ?? m.image_hotspots;
  let hotspotsJson = "";
  if (hotspotsRaw != null) {
    try {
      hotspotsJson =
        typeof hotspotsRaw === "string"
          ? hotspotsRaw
          : JSON.stringify(hotspotsRaw, null, 2);
    } catch {
      hotspotsJson = "";
    }
  }
  const gvRaw = m.gallery_video_urls;
  let galleryVideoUrlsText = "";
  if (Array.isArray(gvRaw)) {
    galleryVideoUrlsText = gvRaw
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim())
      .join("\n");
  } else if (typeof gvRaw === "string" && gvRaw.trim()) {
    try {
      const p = JSON.parse(gvRaw) as unknown;
      if (Array.isArray(p)) {
        galleryVideoUrlsText = p
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim())
          .join("\n");
      }
    } catch {
      galleryVideoUrlsText = "";
    }
  }
  return {
    mediaIds: Array.isArray(m.media_ids)
      ? m.media_ids.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
      : [],
    brand: strOrNull(m.brand ?? m.brand_name),
    videoUrl: strOrNull(m.video_url),
    galleryVideoUrlsText,
    weightKg: numOrNull(m.weight_kg),
    dimensionsLabel: strOrNull(m.dimensions_label ?? m.dimensions_cm),
    material: strOrNull(m.material),
    lifestyleImageUrl: strOrNull(m.lifestyle_image_url),
    seoDescription: strOrNull(m.seo_description),
    relatedHandlesText: relatedText,
    hotspotsJson,
    guitarSpecsJson: typeof m.guitar_specs_json === "string" ? m.guitar_specs_json : "",
    audioDemosJson: typeof m.audio_demos_json === "string" ? m.audio_demos_json : "",
    trustContentJson: typeof m.trust_content_json === "string" ? m.trust_content_json : "",
  };
}

/**
 * Builds metadata patch for Medusa. Omits keys when value is empty (removes from merged object).
 */
export function buildMedusaMetadataPatch(
  fields: CatalogProductMetadataFields,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (fields.mediaIds.length > 0) out.media_ids = [...new Set(fields.mediaIds.map((id) => id.trim()).filter(Boolean))];

  const setStr = (key: string, val: string | null) => {
    if (val != null && val.trim()) out[key] = val.trim();
  };

  setStr("brand", fields.brand);
  setStr("video_url", fields.videoUrl);
  const extraVideos = parseGalleryVideoUrlsInput(fields.galleryVideoUrlsText);
  if (extraVideos.length > 0) {
    out.gallery_video_urls = extraVideos;
  }
  if (fields.weightKg != null && Number.isFinite(fields.weightKg)) {
    out.weight_kg = fields.weightKg;
  }
  if (fields.guitarSpecsJson.trim()) {
    out.guitar_specs_json = fields.guitarSpecsJson.trim();
  }
  if (fields.audioDemosJson.trim()) {
    out.audio_demos_json = fields.audioDemosJson.trim();
  }
  if (fields.trustContentJson.trim()) {
    out.trust_content_json = fields.trustContentJson.trim();
  }
  setStr("dimensions_label", fields.dimensionsLabel);
  setStr("material", fields.material);
  setStr("lifestyle_image_url", fields.lifestyleImageUrl);
  setStr("seo_description", fields.seoDescription);

  const handles = parseRelatedHandlesInput(fields.relatedHandlesText);
  if (handles.length > 0) {
    out.related_handles = handles;
  }

  const hotspots = parseHotspotsJsonInput(fields.hotspotsJson);
  if (hotspots !== null) {
    if (hotspots.length === 0) {
      out.hotspots = [];
    } else {
      out.hotspots = hotspots;
    }
  }

  return out;
}

export function parseRelatedHandlesInput(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.includes(",")) {
    return t
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return t
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** One URL per line (or comma-separated) for extra carousel videos. */
export function parseGalleryVideoUrlsInput(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.includes(",")) {
    return t
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return t
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type HotspotRow = {
  xPct?: number;
  yPct?: number;
  x?: number;
  y?: number;
  productSlug?: string;
  slug?: string;
  label?: string;
};

export function parseHotspotsJsonInput(
  json: string,
): unknown[] | null {
  const t = json.trim();
  if (!t) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(t) as unknown;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const cleaned: unknown[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const o = row as HotspotRow;
    const x = o.xPct ?? o.x;
    const y = o.yPct ?? o.y;
    const slug = o.productSlug ?? o.slug;
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof slug !== "string" ||
      !slug.trim()
    ) {
      continue;
    }
    const item: Record<string, unknown> = {
      xPct: Math.min(100, Math.max(0, x)),
      yPct: Math.min(100, Math.max(0, y)),
      productSlug: slug.trim(),
    };
    if (typeof o.label === "string" && o.label.trim()) {
      item.label = o.label.trim();
    }
    cleaned.push(item);
  }
  return cleaned;
}

/** Non-empty JSON that fails to parse or is not an array. */
export function validateHotspotsJsonField(
  hotspotsJson: string,
): string | null {
  const t = hotspotsJson.trim();
  if (!t) return null;
  try {
    const p = JSON.parse(t) as unknown;
    if (!Array.isArray(p)) {
      return "Hotspots must be a JSON array.";
    }
  } catch {
    return "Hotspots must be valid JSON.";
  }
  return null;
}

/**
 * Merge storefront metadata: clear empty keys, then apply patch from {@link buildMedusaMetadataPatch}.
 */
export function mergeStorefrontProductMetadata(
  existing: Record<string, unknown> | null | undefined,
  fields: CatalogProductMetadataFields,
): Record<string, unknown> {
  const merged = { ...(existing ?? {}) } as Record<string, unknown>;
  for (const key of metadataKeysToClear(fields)) {
    delete merged[key];
  }
  const patch = buildMedusaMetadataPatch(fields);
  Object.assign(merged, patch);
  return merged;
}

/** Keys we manage in the catalog editor (for removal when clearing fields). */
export const CATALOG_METADATA_KEYS = [
  "brand",
  "video_url",
  "gallery_video_urls",
  "weight_kg",
  "dimensions_label",
  "material",
  "lifestyle_image_url",
  "seo_description",
  "related_handles",
  "hotspots",
  "guitar_specs_json",
  "audio_demos_json",
  "trust_content_json",
  "media_ids",
] as const;

export function metadataKeysToClear(
  fields: CatalogProductMetadataFields,
): string[] {
  const clear: string[] = [];
  if (!fields.brand?.trim()) clear.push("brand");
  if (!fields.videoUrl?.trim()) clear.push("video_url");
  if (!parseGalleryVideoUrlsInput(fields.galleryVideoUrlsText).length) {
    clear.push("gallery_video_urls");
  }
  if (fields.weightKg == null || !Number.isFinite(fields.weightKg)) {
    clear.push("weight_kg");
  }
  if (!fields.dimensionsLabel?.trim()) clear.push("dimensions_label");
  if (!fields.material?.trim()) clear.push("material");
  if (!fields.lifestyleImageUrl?.trim()) clear.push("lifestyle_image_url");
  if (!fields.seoDescription?.trim()) clear.push("seo_description");
  if (!parseRelatedHandlesInput(fields.relatedHandlesText).length) {
    clear.push("related_handles");
  }
  const hs = parseHotspotsJsonInput(fields.hotspotsJson);
  if (hs === null || hs.length === 0) {
    clear.push("hotspots");
    clear.push("image_hotspots");
  }
  if (!fields.guitarSpecsJson.trim()) clear.push("guitar_specs_json");
  if (!fields.audioDemosJson.trim()) clear.push("audio_demos_json");
  if (!fields.trustContentJson.trim()) clear.push("trust_content_json");
  if (fields.mediaIds.length === 0) clear.push("media_ids");
  return clear;
}
