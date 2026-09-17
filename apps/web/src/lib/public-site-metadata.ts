import { loadStorefrontPublicMetadataResolvedForPublic } from "@universal-music-store/platform-data";
import { cache } from "react";

/**
 * One resolved snapshot per request (CMS first, then NEXT_PUBLIC_* env).
 * Deduplicates when layout and pages both need contact/social data.
 */
export const getCachedPublicSiteMetadata = cache(loadStorefrontPublicMetadataResolvedForPublic);
