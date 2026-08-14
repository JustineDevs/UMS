import { DEFAULT_PUBLIC_SITE_ORIGIN } from "@universal-music-store/sdk";

/** Public storefront origin for links from the admin (shop preview, customer view). */
export function getStorefrontPublicOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.PUBLIC_STOREFRONT_URL?.trim() ||
    DEFAULT_PUBLIC_SITE_ORIGIN;
  return raw.replace(/\/$/, "");
}
