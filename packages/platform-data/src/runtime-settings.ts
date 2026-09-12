import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export const RUNTIME_PAYMENT_PROVIDERS = ["STRIPE", "PAYPAL", "XENDIT", "COD"] as const;
export type RuntimePaymentProvider = (typeof RUNTIME_PAYMENT_PROVIDERS)[number];

export type PlatformRuntimeSettings = {
  maintenanceMode: boolean;
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  cmsLocale: string;
  merchantCountry: string;
  enabledPaymentProviders: RuntimePaymentProvider[];
  featureFlags: {
    stripe: boolean;
    paypal: boolean;
    xendit: boolean;
    pancakePos: boolean;
    loyalty: boolean;
    reviews: boolean;
    experiments: boolean;
  };
  retentionDays: number;
  lowStockThreshold: number;
  rateLimits: {
    checkoutIntentPerMinute: number;
    checkoutBurstPerMinute: number;
    checkoutMaxPer15Minutes: number;
    publicTrackPerMinute: number;
  };
  pickup: {
    name: string;
    phone: string;
    province: string;
    city: string;
    area: string;
    address: string;
  };
  policyLinks: {
    shipping: string;
    returns: string;
    terms: string;
    privacy: string;
    cookies: string;
    accessibility: string;
    warrantyPdf: string;
  };
  medusa: {
    regionId: string;
    salesChannelId: string;
    paymentProviderId: string;
  };
  nangoPaymentConnectionId: string;
  nangoPaymentProviderConfigKey: string;
};

type RuntimeEnv = Record<string, string | undefined>;

const DEFAULTS: PlatformRuntimeSettings = {
  maintenanceMode: false,
  storeName: "Universal Music Store",
  supportEmail: "contact@universal-music-store.store",
  supportPhone: "",
  cmsLocale: "en",
  merchantCountry: "PH",
  enabledPaymentProviders: ["COD"],
  featureFlags: {
    stripe: true,
    paypal: true,
    xendit: true,
    pancakePos: true,
    loyalty: true,
    reviews: true,
    experiments: true,
  },
  retentionDays: 730,
  lowStockThreshold: 1000,
  rateLimits: {
    checkoutIntentPerMinute: 24,
    checkoutBurstPerMinute: 8,
    checkoutMaxPer15Minutes: 30,
    publicTrackPerMinute: 60,
  },
  pickup: { name: "Universal Music Store", phone: "", province: "Cavite", city: "General Trias", area: "Navarro", address: "" },
  policyLinks: { shipping: "/shipping", returns: "/returns", terms: "/terms", privacy: "/privacy", cookies: "/cookies", accessibility: "/accessibility", warrantyPdf: "" },
  medusa: { regionId: "", salesChannelId: "", paymentProviderId: "pp_stripe_stripe" },
  nangoPaymentConnectionId: "",
  nangoPaymentProviderConfigKey: "",
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown, fallback: string, max = 320): string {
  return typeof value === "string" && value.trim().length <= max ? value.trim() : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function integer(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function safeUrl(value: unknown, fallback: string): string {
  const candidate = text(value, fallback, 2_048);
  if (candidate.startsWith("/")) return candidate;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? candidate : fallback;
  } catch {
    return fallback;
  }
}

function envBool(env: RuntimeEnv, key: string, fallback: boolean): boolean {
  const value = env[key]?.trim().toLowerCase();
  return value === undefined || value === "" ? fallback : ["1", "true", "yes", "on"].includes(value);
}

function envInt(env: RuntimeEnv, key: string, fallback: number, min: number, max: number): number {
  return integer(env[key], fallback, min, max);
}

function envProviders(env: RuntimeEnv): RuntimePaymentProvider[] {
  const raw = env.NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS?.trim();
  if (!raw) return [...DEFAULTS.enabledPaymentProviders];
  return [...new Set(raw.split(",").map((v) => v.trim().toUpperCase()).filter((v): v is RuntimePaymentProvider => (RUNTIME_PAYMENT_PROVIDERS as readonly string[]).includes(v)))];
}

export function defaultPlatformRuntimeSettings(env: RuntimeEnv = process.env): PlatformRuntimeSettings {
  return {
    ...DEFAULTS,
    maintenanceMode: envBool(env, "NEXT_PUBLIC_MAINTENANCE_MODE", DEFAULTS.maintenanceMode),
    storeName: text(env.STORE_NAME, DEFAULTS.storeName),
    supportEmail: text(env.NEXT_PUBLIC_SUPPORT_EMAIL ?? env.RESEND_FROM_EMAIL, DEFAULTS.supportEmail),
    supportPhone: text(env.NEXT_PUBLIC_SUPPORT_PHONE, DEFAULTS.supportPhone),
    cmsLocale: text(env.NEXT_PUBLIC_CMS_LOCALE, DEFAULTS.cmsLocale, 16),
    merchantCountry: text(env.UVS_MERCHANT_COUNTRY, DEFAULTS.merchantCountry, 3).toUpperCase(),
    enabledPaymentProviders: envProviders(env),
    featureFlags: {
      stripe: envBool(env, "FEATURE_FLAG_STRIPE", true),
      paypal: envBool(env, "FEATURE_FLAG_PAYPAL", true),
      xendit: envBool(env, "FEATURE_FLAG_XENDIT", true),
      pancakePos: envBool(env, "FEATURE_FLAG_PANCAKE_POS", true),
      loyalty: envBool(env, "FEATURE_FLAG_LOYALTY", true),
      reviews: envBool(env, "FEATURE_FLAG_REVIEWS", true),
      experiments: envBool(env, "FEATURE_FLAG_EXPERIMENTS", true),
    },
    retentionDays: envInt(env, "DATA_RETENTION_DAYS", 730, 1, 3_650),
    lowStockThreshold: envInt(env, "ADMIN_LOW_STOCK_THRESHOLD", 1000, 0, 10_000_000),
    rateLimits: {
      checkoutIntentPerMinute: envInt(env, "CHECKOUT_INTENT_PER_MIN", 24, 1, 10_000),
      checkoutBurstPerMinute: envInt(env, "CHECKOUT_INTENT_BURST_PER_MIN", 8, 1, 10_000),
      checkoutMaxPer15Minutes: envInt(env, "CHECKOUT_INTENT_MAX_PER_15_MIN", envInt(env, "CHECKOUT_MAX_PER_15MIN", 30, 1, 100_000), 1, 100_000),
      publicTrackPerMinute: envInt(env, "PUBLIC_TRACK_RATE_MAX", 60, 1, 10_000),
    },
    pickup: {
      name: text(env.PANCAKE_POS_PICKUP_NAME, DEFAULTS.pickup.name),
      phone: text(env.PANCAKE_POS_PICKUP_PHONE, DEFAULTS.pickup.phone),
      province: text(env.PANCAKE_POS_PICKUP_PROVINCE, DEFAULTS.pickup.province),
      city: text(env.PANCAKE_POS_PICKUP_CITY, DEFAULTS.pickup.city),
      area: text(env.PANCAKE_POS_PICKUP_AREA, DEFAULTS.pickup.area),
      address: text(env.PANCAKE_POS_PICKUP_ADDRESS, DEFAULTS.pickup.address, 1_000),
    },
    policyLinks: {
      shipping: safeUrl(env.NEXT_PUBLIC_SHIPPING_POLICY_URL, DEFAULTS.policyLinks.shipping),
      returns: safeUrl(env.NEXT_PUBLIC_RETURNS_POLICY_URL, DEFAULTS.policyLinks.returns),
      terms: safeUrl(env.NEXT_PUBLIC_TERMS_URL, DEFAULTS.policyLinks.terms),
      privacy: safeUrl(env.NEXT_PUBLIC_PRIVACY_URL, DEFAULTS.policyLinks.privacy),
      cookies: safeUrl(env.NEXT_PUBLIC_COOKIES_URL, DEFAULTS.policyLinks.cookies),
      accessibility: safeUrl(env.NEXT_PUBLIC_ACCESSIBILITY_URL, DEFAULTS.policyLinks.accessibility),
      warrantyPdf: safeUrl(env.NEXT_PUBLIC_WARRANTY_PDF_URL, DEFAULTS.policyLinks.warrantyPdf),
    },
    medusa: {
      regionId: text(env.MEDUSA_REGION_ID ?? env.NEXT_PUBLIC_MEDUSA_REGION_ID, "", 128),
      salesChannelId: text(env.MEDUSA_SALES_CHANNEL_ID ?? env.NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID, "", 128),
      paymentProviderId: text(env.NEXT_PUBLIC_MEDUSA_PAYMENT_PROVIDER_ID, DEFAULTS.medusa.paymentProviderId, 128),
    },
    nangoPaymentConnectionId: text(env.NANGO_PAYMENT_CONNECTION_ID, "", 256),
    nangoPaymentProviderConfigKey: text(env.NANGO_PAYMENT_PROVIDER_CONFIG_KEY, "", 256),
  };
}

export function mergePlatformRuntimeSettings(partial: unknown, env: RuntimeEnv = process.env): PlatformRuntimeSettings {
  const base = defaultPlatformRuntimeSettings(env);
  const input = record(partial);
  const flags = record(input.featureFlags);
  const limits = record(input.rateLimits);
  const pickup = record(input.pickup);
  const links = record(input.policyLinks);
  const medusa = record(input.medusa);
  const providers = Array.isArray(input.enabledPaymentProviders)
    ? [...new Set(input.enabledPaymentProviders.filter((v): v is RuntimePaymentProvider => typeof v === "string" && (RUNTIME_PAYMENT_PROVIDERS as readonly string[]).includes(v)))]
    : base.enabledPaymentProviders;
  return {
    ...base,
    maintenanceMode: bool(input.maintenanceMode, base.maintenanceMode),
    storeName: text(input.storeName, base.storeName),
    supportEmail: text(input.supportEmail, base.supportEmail),
    supportPhone: text(input.supportPhone, base.supportPhone),
    cmsLocale: text(input.cmsLocale, base.cmsLocale, 16),
    merchantCountry: text(input.merchantCountry, base.merchantCountry, 3).toUpperCase(),
    enabledPaymentProviders: providers,
    featureFlags: {
      stripe: bool(flags.stripe, base.featureFlags.stripe), paypal: bool(flags.paypal, base.featureFlags.paypal), xendit: bool(flags.xendit, base.featureFlags.xendit), pancakePos: bool(flags.pancakePos, base.featureFlags.pancakePos), loyalty: bool(flags.loyalty, base.featureFlags.loyalty), reviews: bool(flags.reviews, base.featureFlags.reviews), experiments: bool(flags.experiments, base.featureFlags.experiments),
    },
    retentionDays: integer(input.retentionDays, base.retentionDays, 1, 3_650),
    lowStockThreshold: integer(input.lowStockThreshold, base.lowStockThreshold, 0, 10_000_000),
    rateLimits: { checkoutIntentPerMinute: integer(limits.checkoutIntentPerMinute, base.rateLimits.checkoutIntentPerMinute, 1, 10_000), checkoutBurstPerMinute: integer(limits.checkoutBurstPerMinute, base.rateLimits.checkoutBurstPerMinute, 1, 10_000), checkoutMaxPer15Minutes: integer(limits.checkoutMaxPer15Minutes, base.rateLimits.checkoutMaxPer15Minutes, 1, 100_000), publicTrackPerMinute: integer(limits.publicTrackPerMinute, base.rateLimits.publicTrackPerMinute, 1, 10_000) },
    pickup: { name: text(pickup.name, base.pickup.name), phone: text(pickup.phone, base.pickup.phone), province: text(pickup.province, base.pickup.province), city: text(pickup.city, base.pickup.city), area: text(pickup.area, base.pickup.area), address: text(pickup.address, base.pickup.address, 1_000) },
    policyLinks: { shipping: safeUrl(links.shipping, base.policyLinks.shipping), returns: safeUrl(links.returns, base.policyLinks.returns), terms: safeUrl(links.terms, base.policyLinks.terms), privacy: safeUrl(links.privacy, base.policyLinks.privacy), cookies: safeUrl(links.cookies, base.policyLinks.cookies), accessibility: safeUrl(links.accessibility, base.policyLinks.accessibility), warrantyPdf: safeUrl(links.warrantyPdf, base.policyLinks.warrantyPdf) },
    medusa: { regionId: text(medusa.regionId, base.medusa.regionId, 128), salesChannelId: text(medusa.salesChannelId, base.medusa.salesChannelId, 128), paymentProviderId: text(medusa.paymentProviderId, base.medusa.paymentProviderId, 128) },
    nangoPaymentConnectionId: text(input.nangoPaymentConnectionId, base.nangoPaymentConnectionId, 256),
    nangoPaymentProviderConfigKey: text(input.nangoPaymentProviderConfigKey, base.nangoPaymentProviderConfigKey, 256),
  };
}

export async function getPlatformRuntimeSettings(supabase: SupabaseClient, organizationId: string, env: RuntimeEnv = process.env): Promise<PlatformRuntimeSettings> {
  const { data, error } = await supabase.from("platform_runtime_settings").select("payload").eq("organization_id", organizationId).maybeSingle();
  if (error) {
    if (!isMissingTableOrSchemaError(error)) throw new Error(error.message);
    return defaultPlatformRuntimeSettings(env);
  }
  return mergePlatformRuntimeSettings((data as { payload?: unknown } | null)?.payload, env);
}

export async function upsertPlatformRuntimeSettings(supabase: SupabaseClient, organizationId: string, payload: unknown, updatedBy: string): Promise<PlatformRuntimeSettings> {
  const merged = mergePlatformRuntimeSettings(payload);
  const { error } = await supabase.from("platform_runtime_settings").upsert({ organization_id: organizationId, payload: merged, updated_by: updatedBy }, { onConflict: "organization_id" });
  if (error) throw new Error(error.message);
  return merged;
}
