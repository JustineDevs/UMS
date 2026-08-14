import {
  getMedusaAdminBaseUrl as getMedusaAdminBaseUrlBase,
  getMedusaStoreBaseUrl as getMedusaStoreBaseUrlBase,
  getMedusaPublishableKey as getMedusaPublishableKeyBase,
  getMedusaRegionId as getMedusaRegionIdBase,
  getMedusaPaymentProviderId as getMedusaPaymentProviderIdBase,
  getMedusaSalesChannelId as getMedusaSalesChannelIdBase,
  getMedusaSecretApiKey as getMedusaSecretApiKeyBase,
  withSalesChannelId as withSalesChannelIdBase,
} from "@universal-music-store/sdk";

/** Env hydration from monorepo root `.env.local` files runs in `instrumentation.ts` (Node only). */

export function getMedusaStoreBaseUrl(): string {
  return getMedusaStoreBaseUrlBase();
}

export function getMedusaAdminBaseUrl(): string {
  return getMedusaAdminBaseUrlBase();
}

export function getMedusaPublishableKey(): string | undefined {
  return getMedusaPublishableKeyBase();
}

export function getMedusaRegionId(): string | undefined {
  return getMedusaRegionIdBase();
}

export function getMedusaPaymentProviderId(): string {
  return getMedusaPaymentProviderIdBase();
}

export function getMedusaSalesChannelId(): string | undefined {
  return getMedusaSalesChannelIdBase();
}

export function getMedusaSecretApiKey(): string | undefined {
  return getMedusaSecretApiKeyBase();
}

export function withSalesChannelId(
  params: Record<string, unknown>,
): Record<string, unknown> {
  return withSalesChannelIdBase(params);
}
