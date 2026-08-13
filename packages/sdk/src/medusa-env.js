/**
 * Shared Medusa URL and publishable env for storefront, admin server routes, and tooling.
 * Reads MEDUSA_* and NEXT_PUBLIC_MEDUSA_* per SOP-MEDUSA-ENV-AND-LEGACY.
 * Treats empty or whitespace-only values as unset (prevents "Invalid URL" when env is "").
 *
 * Server-side catalog fetches run in Node (Next.js RCS), not in the visitor's browser.
 * If MEDUSA_BACKEND_URL is still http://localhost:9000 (copied from local .env.local) but
 * NEXT_PUBLIC_MEDUSA_URL is a non-loopback URL (e.g. deployed Medusa on Render), we prefer
 * the public URL so hosted storefronts do not call the host's own localhost.
 */
function stripTrailingSlash(raw) {
    return raw.replace(/\/$/, "");
}
function isLoopbackMedusaUrl(url) {
    const lower = url.toLowerCase();
    return (lower.includes("localhost") ||
        lower.includes("127.0.0.1") ||
        lower.startsWith("http://0.0.0.0"));
}
export function getMedusaStoreBaseUrl() {
    const backend = process.env.MEDUSA_BACKEND_URL?.trim() || undefined;
    const publicUrl = process.env.NEXT_PUBLIC_MEDUSA_URL?.trim() || undefined;
    let raw;
    if (backend &&
        isLoopbackMedusaUrl(backend) &&
        publicUrl &&
        !isLoopbackMedusaUrl(publicUrl)) {
        raw = publicUrl;
    }
    else {
        raw = backend ?? publicUrl ?? "http://localhost:9000";
    }
    const url = stripTrailingSlash(raw);
    if (!url)
        return "http://localhost:9000";
    try {
        new URL(url);
        return url;
    }
    catch {
        return "http://localhost:9000";
    }
}
/**
 * Admin and server-side Medusa clients use the same resolved backend origin,
 * but this name makes the caller intent explicit.
 */
export function getMedusaAdminBaseUrl() {
    return getMedusaStoreBaseUrl();
}
export function getMedusaSecretApiKey() {
    const k = process.env.MEDUSA_SECRET_API_KEY?.trim() ||
        process.env.MEDUSA_ADMIN_API_SECRET?.trim();
    return k || undefined;
}
export function getMedusaPublishableKey() {
    const k = process.env.MEDUSA_PUBLISHABLE_API_KEY ??
        process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
    return k?.trim() || undefined;
}
export function getMedusaRegionId() {
    const r = process.env.MEDUSA_REGION_ID ?? process.env.NEXT_PUBLIC_MEDUSA_REGION_ID;
    return r?.trim() || undefined;
}
export function getMedusaPaymentProviderId() {
    return (process.env.NEXT_PUBLIC_MEDUSA_PAYMENT_PROVIDER_ID?.trim() ||
        "pp_stripe_stripe");
}
export function getMedusaSalesChannelId() {
    return (process.env.MEDUSA_SALES_CHANNEL_ID?.trim() ||
        process.env.NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID?.trim() ||
        undefined);
}
/**
 * Merge `sales_channel_id` into Store API query params when env is set (products, carts).
 * Do not use for `GET /store/product-categories`: Medusa v2 rejects `sales_channel_id`
 * on that route (400 Unrecognized fields). Category sidebars rely on `store.product.list`
 * with `sales_channel_id` for per-category counts instead.
 */
export function withSalesChannelId(params) {
    const sc = getMedusaSalesChannelId()?.trim();
    if (sc)
        params.sales_channel_id = sc;
    return params;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVkdXNhLWVudi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1lZHVzYS1lbnYudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7OztHQVNHO0FBQ0gsU0FBUyxrQkFBa0IsQ0FBQyxHQUFXO0lBQ3JDLE9BQU8sR0FBRyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDaEMsQ0FBQztBQUVELFNBQVMsbUJBQW1CLENBQUMsR0FBVztJQUN0QyxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDaEMsT0FBTyxDQUNMLEtBQUssQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDO1FBQzNCLEtBQUssQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDO1FBQzNCLEtBQUssQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsQ0FDbkMsQ0FBQztBQUNKLENBQUM7QUFFRCxNQUFNLFVBQVUscUJBQXFCO0lBQ25DLE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLEVBQUUsSUFBSSxFQUFFLElBQUksU0FBUyxDQUFDO0lBQ3BFLE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLEVBQUUsSUFBSSxFQUFFLElBQUksU0FBUyxDQUFDO0lBRTFFLElBQUksR0FBdUIsQ0FBQztJQUM1QixJQUNFLE9BQU87UUFDUCxtQkFBbUIsQ0FBQyxPQUFPLENBQUM7UUFDNUIsU0FBUztRQUNULENBQUMsbUJBQW1CLENBQUMsU0FBUyxDQUFDLEVBQy9CLENBQUM7UUFDRCxHQUFHLEdBQUcsU0FBUyxDQUFDO0lBQ2xCLENBQUM7U0FBTSxDQUFDO1FBQ04sR0FBRyxHQUFHLE9BQU8sSUFBSSxTQUFTLElBQUksdUJBQXVCLENBQUM7SUFDeEQsQ0FBQztJQUVELE1BQU0sR0FBRyxHQUFHLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3BDLElBQUksQ0FBQyxHQUFHO1FBQUUsT0FBTyx1QkFBdUIsQ0FBQztJQUN6QyxJQUFJLENBQUM7UUFDSCxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNiLE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQztJQUFDLE1BQU0sQ0FBQztRQUNQLE9BQU8sdUJBQXVCLENBQUM7SUFDakMsQ0FBQztBQUNILENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUscUJBQXFCO0lBQ25DLE9BQU8scUJBQXFCLEVBQUUsQ0FBQztBQUNqQyxDQUFDO0FBRUQsTUFBTSxVQUFVLHFCQUFxQjtJQUNuQyxNQUFNLENBQUMsR0FDTCxPQUFPLENBQUMsR0FBRyxDQUFDLHFCQUFxQixFQUFFLElBQUksRUFBRTtRQUN6QyxPQUFPLENBQUMsR0FBRyxDQUFDLHVCQUF1QixFQUFFLElBQUksRUFBRSxDQUFDO0lBQzlDLE9BQU8sQ0FBQyxJQUFJLFNBQVMsQ0FBQztBQUN4QixDQUFDO0FBRUQsTUFBTSxVQUFVLHVCQUF1QjtJQUNyQyxNQUFNLENBQUMsR0FDTCxPQUFPLENBQUMsR0FBRyxDQUFDLDBCQUEwQjtRQUN0QyxPQUFPLENBQUMsR0FBRyxDQUFDLGtDQUFrQyxDQUFDO0lBQ2pELE9BQU8sQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLFNBQVMsQ0FBQztBQUNoQyxDQUFDO0FBRUQsTUFBTSxVQUFVLGlCQUFpQjtJQUMvQixNQUFNLENBQUMsR0FDTCxPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsNEJBQTRCLENBQUM7SUFDM0UsT0FBTyxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksU0FBUyxDQUFDO0FBQ2hDLENBQUM7QUFFRCxNQUFNLFVBQVUsMEJBQTBCO0lBQ3hDLE9BQU8sQ0FDTCxPQUFPLENBQUMsR0FBRyxDQUFDLHNDQUFzQyxFQUFFLElBQUksRUFBRTtRQUMxRCxrQkFBa0IsQ0FDbkIsQ0FBQztBQUNKLENBQUM7QUFFRCxNQUFNLFVBQVUsdUJBQXVCO0lBQ3JDLE9BQU8sQ0FDTCxPQUFPLENBQUMsR0FBRyxDQUFDLHVCQUF1QixFQUFFLElBQUksRUFBRTtRQUMzQyxPQUFPLENBQUMsR0FBRyxDQUFDLG1DQUFtQyxFQUFFLElBQUksRUFBRTtRQUN2RCxTQUFTLENBQ1YsQ0FBQztBQUNKLENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILE1BQU0sVUFBVSxrQkFBa0IsQ0FDaEMsTUFBK0I7SUFFL0IsTUFBTSxFQUFFLEdBQUcsdUJBQXVCLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQztJQUM3QyxJQUFJLEVBQUU7UUFBRSxNQUFNLENBQUMsZ0JBQWdCLEdBQUcsRUFBRSxDQUFDO0lBQ3JDLE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUMifQ==