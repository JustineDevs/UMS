export type FeatureFlagDef = {
  key: string;
  envVar: string;
  defaultEnabled: boolean;
  description: string;
  killSwitch: boolean;
};

export const FEATURE_FLAG_CONTRACT_VERSION = 1;

const FLAG_REGISTRY: FeatureFlagDef[] = [
  { key: "stripe", envVar: "FEATURE_FLAG_STRIPE", defaultEnabled: true, description: "Stripe payment provider", killSwitch: true },
  { key: "paypal", envVar: "FEATURE_FLAG_PAYPAL", defaultEnabled: true, description: "PayPal payment provider", killSwitch: true },
  { key: "xendit", envVar: "FEATURE_FLAG_XENDIT", defaultEnabled: true, description: "Xendit payment provider", killSwitch: true },
  { key: "pancake_pos", envVar: "FEATURE_FLAG_PANCAKE_POS", defaultEnabled: true, description: "Pancake POS logistics bridge", killSwitch: true },
  { key: "loyalty_points", envVar: "FEATURE_FLAG_LOYALTY", defaultEnabled: true, description: "Loyalty points system", killSwitch: true },
  { key: "subscriptions", envVar: "FEATURE_FLAG_SUBSCRIPTIONS", defaultEnabled: false, description: "Subscription/installment payments", killSwitch: false },
  { key: "experiments", envVar: "FEATURE_FLAG_EXPERIMENTS", defaultEnabled: true, description: "CMS A/B experiments", killSwitch: true },
  { key: "bopis", envVar: "FEATURE_FLAG_BOPIS", defaultEnabled: true, description: "Buy online pick up in store", killSwitch: true },
  { key: "reviews", envVar: "FEATURE_FLAG_REVIEWS", defaultEnabled: true, description: "Customer reviews", killSwitch: false },
  { key: "i18n", envVar: "FEATURE_FLAG_I18N", defaultEnabled: false, description: "Multi-language support", killSwitch: false },
  { key: "warehouse_export", envVar: "FEATURE_FLAG_WAREHOUSE_EXPORT", defaultEnabled: false, description: "Nightly warehouse export", killSwitch: true },
  { key: "fraud_signals", envVar: "FEATURE_FLAG_FRAUD", defaultEnabled: false, description: "Fraud/risk signal scoring", killSwitch: true },
];

function readEnvFlag(envVar: string, defaultEnabled: boolean): boolean {
  const value = typeof process !== "undefined" ? process.env?.[envVar] : undefined;
  if (value === undefined || value === "") return defaultEnabled;
  return value === "1" || value.toLowerCase() === "true";
}

export function isFeatureEnabled(key: string): boolean {
  const def = FLAG_REGISTRY.find((f) => f.key === key);
  if (!def) return true;
  return readEnvFlag(def.envVar, def.defaultEnabled);
}

export function getFeatureFlags(): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const def of FLAG_REGISTRY) {
    result[def.key] = readEnvFlag(def.envVar, def.defaultEnabled);
  }
  return result;
}

export function getKillSwitchFlags(): FeatureFlagDef[] {
  return FLAG_REGISTRY.filter((f) => f.killSwitch);
}

export function getAllFlagDefs(): FeatureFlagDef[] {
  return [...FLAG_REGISTRY];
}

export function getDisabledFeatures(): string[] {
  return FLAG_REGISTRY.filter((f) => !readEnvFlag(f.envVar, f.defaultEnabled)).map((f) => f.key);
}
