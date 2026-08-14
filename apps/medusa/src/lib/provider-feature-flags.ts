const PROVIDER_FLAGS: Record<string, string> = {
  stripe: "FEATURE_FLAG_STRIPE",
  paypal: "FEATURE_FLAG_PAYPAL",
  xendit: "FEATURE_FLAG_XENDIT",
  pancake_pos: "FEATURE_FLAG_PANCAKE_POS",
};

export function isProviderEnabled(provider: string): boolean {
  const envKey = PROVIDER_FLAGS[provider.toLowerCase()];
  if (!envKey) return true;

  const value = process.env[envKey];
  if (value === undefined || value === "") return true;
  return value === "1" || value.toLowerCase() === "true";
}

export function getDisabledProviders(): string[] {
  return Object.keys(PROVIDER_FLAGS).filter((p) => !isProviderEnabled(p));
}
