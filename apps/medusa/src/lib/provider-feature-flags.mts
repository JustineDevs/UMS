import { getAllFlagDefs, isFeatureEnabled } from "@universal-music-store/sdk/feature-flags";

const PROVIDER_KEYS = ["stripe", "paypal", "xendit", "pancake_pos"] as const;

export function isProviderEnabled(provider: string): boolean {
  return getAllFlagDefs().some((flag) => flag.key === provider.toLowerCase())
    ? isFeatureEnabled(provider.toLowerCase())
    : true;
}

export function getDisabledProviders(): string[] {
  return PROVIDER_KEYS.filter((provider) => !isProviderEnabled(provider));
}
