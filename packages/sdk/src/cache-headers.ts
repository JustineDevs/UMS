export type CacheProfile = "static" | "catalog" | "dynamic" | "private" | "no-cache";

const CACHE_PROFILES: Record<CacheProfile, string> = {
  static: "public, max-age=31536000, immutable",
  catalog: "public, max-age=60, stale-while-revalidate=300",
  dynamic: "public, max-age=0, must-revalidate",
  private: "private, max-age=0, no-store",
  "no-cache": "no-cache, no-store, must-revalidate",
};

export function getCacheControlHeader(profile: CacheProfile): string {
  return CACHE_PROFILES[profile];
}

export function applyCacheHeaders(
  headers: Headers,
  profile: CacheProfile,
): void {
  headers.set("Cache-Control", getCacheControlHeader(profile));
  if (profile === "static") {
    headers.set("CDN-Cache-Control", "public, max-age=31536000");
  }
  if (profile === "catalog") {
    headers.set("CDN-Cache-Control", "public, max-age=300");
    headers.set("Surrogate-Control", "max-age=300");
  }
}

export const ROUTE_CACHE_MAP: Record<string, CacheProfile> = {
  "/api/shop/product": "catalog",
  "/api/shop/search-suggest": "catalog",
  "/api/cms/preview": "no-cache",
  "/api/health": "no-cache",
  "/api/cart": "private",
  "/api/account": "private",
  "/api/admin": "private",
  "/_next/static": "static",
  "/images": "static",
};

export function resolveCacheProfile(pathname: string): CacheProfile {
  for (const [pattern, profile] of Object.entries(ROUTE_CACHE_MAP)) {
    if (pathname.startsWith(pattern)) return profile;
  }
  return "dynamic";
}
