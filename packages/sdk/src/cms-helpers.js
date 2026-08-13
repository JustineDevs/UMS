/**
 * Builds the storefront preview API URL (GET) for a CMS page or blog row.
 */
export function buildCmsPreviewUrl(input) {
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
const DEFAULT_LOCALE = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_CMS_LOCALE?.trim()) ||
    "en";
/**
 * Normalizes CMS locale: empty, whitespace, or "default" maps to default locale (env or en).
 */
export function normalizeCmsLocale(locale) {
    const t = (locale ?? "").trim().toLowerCase();
    if (!t || t === "default")
        return DEFAULT_LOCALE;
    return t;
}
/**
 * Builds a public Supabase Storage URL for a CMS bucket object path (no signing).
 * For private buckets use the admin SDK or a signed-URL API route instead.
 */
export function buildCmsStoragePublicUrl(supabaseUrl, bucket, objectPath) {
    const base = supabaseUrl.replace(/\/$/, "");
    const path = objectPath.replace(/^\//, "");
    return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY21zLWhlbHBlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjbXMtaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFXQTs7R0FFRztBQUNILE1BQU0sVUFBVSxrQkFBa0IsQ0FBQyxLQUE4QjtJQUMvRCxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDbkQsTUFBTSxNQUFNLEdBQUcsa0JBQWtCLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2hELE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLElBQUksTUFBTSxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxHQUFHLElBQUksZUFBZSxDQUFDO1FBQzVCLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRTtRQUN2QixNQUFNO1FBQ04sS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFO1FBQ3pCLElBQUk7S0FDTCxDQUFDLENBQUM7SUFDSCxPQUFPLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUM7QUFDckQsQ0FBQztBQUVELE1BQU0sY0FBYyxHQUNsQixDQUFDLE9BQU8sT0FBTyxLQUFLLFdBQVcsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLHNCQUFzQixFQUFFLElBQUksRUFBRSxDQUFDO0lBQzlFLElBQUksQ0FBQztBQUVQOztHQUVHO0FBQ0gsTUFBTSxVQUFVLGtCQUFrQixDQUFDLE1BQWlDO0lBQ2xFLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQzlDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLFNBQVM7UUFBRSxPQUFPLGNBQWMsQ0FBQztJQUNqRCxPQUFPLENBQUMsQ0FBQztBQUNYLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsd0JBQXdCLENBQ3RDLFdBQW1CLEVBQ25CLE1BQWMsRUFDZCxVQUFrQjtJQUVsQixNQUFNLElBQUksR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztJQUM1QyxNQUFNLElBQUksR0FBRyxVQUFVLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztJQUMzQyxPQUFPLEdBQUcsSUFBSSw2QkFBNkIsTUFBTSxJQUFJLElBQUksRUFBRSxDQUFDO0FBQzlELENBQUMifQ==