export type CmsPreviewUrlKind = "page" | "blog";

export type BuildCmsPreviewUrlInput = {
  /** Origin only, e.g. https://shop.example.com */
  siteOrigin: string;
  slug: string;
  locale?: string;
  token: string;
  kind?: CmsPreviewUrlKind;
};

/**
 * Builds the storefront preview API URL (GET) for a CMS page or blog row.
 */
export function buildCmsPreviewUrl(input: BuildCmsPreviewUrlInput): string {
  const origin = input.siteOrigin.replace(/\/$/, "");
  const locale = normalizeCmsLocale(input.locale);
  const kind = input.kind ?? "page";
  const q = new URLSearchParams({
    slug: input.slug.trim(),
    locale,
    token: input.token.trim(),
    kind,
  });
  return `${origin}/api/cms/preview?${q.toString()}`;
}

const DEFAULT_LOCALE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_CMS_LOCALE?.trim()) ||
  "en";

/**
 * Normalizes CMS locale: empty, whitespace, or "default" maps to default locale (env or en).
 */
export function normalizeCmsLocale(locale: string | undefined | null): string {
  const t = (locale ?? "").trim().toLowerCase();
  if (!t || t === "default") return DEFAULT_LOCALE;
  return t;
}

/**
 * Builds a public Supabase Storage URL for a CMS bucket object path (no signing).
 * For private buckets use the admin SDK or a signed-URL API route instead.
 */
export function buildCmsStoragePublicUrl(
  supabaseUrl: string,
  bucket: string,
  objectPath: string,
): string {
  const base = supabaseUrl.replace(/\/$/, "");
  const path = objectPath.replace(/^\//, "");
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
