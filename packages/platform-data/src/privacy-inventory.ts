export type PrivacyDataAction = "export" | "delete" | "retain";
export type PrivacyDataAsset = {
  table: string;
  owner: "supabase" | "medusa" | "provider";
  contains: readonly string[];
  retentionDays: number | null;
  actions: readonly PrivacyDataAction[];
};

export const PRIVACY_DATA_INVENTORY: readonly PrivacyDataAsset[] = [
  { table: "users", owner: "supabase", contains: ["identity", "email"], retentionDays: null, actions: ["export", "delete"] },
  { table: "marketing_preferences", owner: "supabase", contains: ["email", "consent"], retentionDays: null, actions: ["export", "delete"] },
  { table: "newsletter_confirmations", owner: "supabase", contains: ["email", "confirmation token"], retentionDays: 30, actions: ["delete", "retain"] },
  { table: "back_in_stock_notifications", owner: "supabase", contains: ["email", "product interest"], retentionDays: 365, actions: ["export", "delete", "retain"] },
  { table: "public_delivery_attempts", owner: "supabase", contains: ["recipient", "delivery metadata"], retentionDays: 730, actions: ["export", "delete", "retain"] },
  { table: "storefront_profiles", owner: "supabase", contains: ["profile"], retentionDays: 730, actions: ["export", "delete", "retain"] },
  { table: "orders", owner: "medusa", contains: ["commerce record", "address"], retentionDays: null, actions: ["export", "retain"] },
] as const;

export function privacyAsset(table: string): PrivacyDataAsset | undefined {
  return PRIVACY_DATA_INVENTORY.find((asset) => asset.table === table);
}

export function retentionCutoff(now: Date, retentionDays: number): Date {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  return cutoff;
}

export function canSendMarketingEmail(consentStatus: string | null | undefined): boolean {
  return consentStatus === "subscribed";
}
