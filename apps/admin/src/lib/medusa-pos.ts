import Medusa from "@medusajs/js-sdk";
import {
  getMedusaPublishableKey,
  getMedusaRegionId,
  getMedusaSalesChannelId,
  getMedusaSecretApiKey,
  getMedusaStoreBaseUrl,
  withSalesChannelId,
} from "@universal-music-store/sdk";

export function getMedusaSecretKey(): string | undefined {
  return getMedusaSecretApiKey();
}

let _storeSdk: Medusa | null | undefined;
let _adminSdk: Medusa | null | undefined;

export function getMedusaStoreSdk(): Medusa | null {
  if (_storeSdk !== undefined) return _storeSdk;
  const pk = getMedusaPublishableKey();
  if (!pk) { _storeSdk = null; return null; }
  _storeSdk = new Medusa({
    baseUrl: getMedusaStoreBaseUrl(),
    publishableKey: pk,
  });
  return _storeSdk;
}

export function getMedusaAdminSdk(): Medusa | null {
  if (_adminSdk !== undefined) return _adminSdk;
  const secret = getMedusaSecretKey();
  if (!secret) { _adminSdk = null; return null; }
  _adminSdk = new Medusa({
    baseUrl: getMedusaStoreBaseUrl(),
    apiKey: secret,
  });
  return _adminSdk;
}

export { getMedusaRegionId, getMedusaSalesChannelId, withSalesChannelId };

type OptionRow = {
  option?: { title?: string | null } | null;
  value?: string | null;
};

export function optionRowsToSizeColor(
  rows: OptionRow[] | null | undefined,
): { size: string; color: string } {
  let size = "";
  let color = "";
  for (const row of rows ?? []) {
    const title = (row.option?.title ?? "").toLowerCase();
    const val = String(row.value ?? "").trim();
    if (!val) continue;
    if (title.includes("size") || title === "sizes") {
      size = val;
    } else if (title.includes("color") || title.includes("colour")) {
      color = val;
    }
  }
  if (!size && !color && rows?.length === 1) {
    size = String(rows[0]?.value ?? "").trim();
  }
  return { size, color };
}

export function variantPricePhpFromCalculated(
  calculated_price?: { calculated_amount?: number | null } | null,
): number {
  const amt = calculated_price?.calculated_amount;
  if (typeof amt !== "number" || !Number.isFinite(amt)) {
    return 0;
  }
  return Math.round((amt / 100) * 100) / 100;
}

export type ProductThumbSource = {
  thumbnail?: string | null;
  images?: Array<{ url?: string | null } | null> | null;
};

/** Prefer `thumbnail`, else first product image URL from Medusa list/retrieve payloads. */
export function pickProductThumbnailRaw(
  p: ProductThumbSource | null | undefined,
): string | undefined {
  const th = typeof p?.thumbnail === "string" ? p.thumbnail.trim() : "";
  if (th) return th;
  for (const im of p?.images ?? []) {
    const u = typeof im?.url === "string" ? im.url.trim() : "";
    if (u) return u;
  }
  return undefined;
}

/**
 * Medusa `thumbnail` may be absolute (file module URL) or a path under the store API origin.
 * Browser `<img src>` on admin (3001) needs an absolute URL to load assets from Medusa (9000).
 */
export function resolvePosThumbnailUrl(
  thumbnail: string | null | undefined,
): string | undefined {
  const t = typeof thumbnail === "string" ? thumbnail.trim() : "";
  if (!t) return undefined;
  if (/^https?:\/\//i.test(t)) {
    return t;
  }
  const base = getMedusaStoreBaseUrl().replace(/\/$/, "");
  const path = t.startsWith("/") ? t : `/${t}`;
  return `${base}${path}`;
}

export function resolvePosProductImageUrl(
  p: ProductThumbSource | null | undefined,
): string | undefined {
  return resolvePosThumbnailUrl(pickProductThumbnailRaw(p));
}
