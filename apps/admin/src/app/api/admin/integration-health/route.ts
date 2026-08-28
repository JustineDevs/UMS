import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { resolveStaffOrganization } from "@/lib/staff-organization";

export type IntegrationHealthEntry = {
  provider: string;
  status: "healthy" | "degraded" | "down" | "unconfigured";
  sdkVersion: string | null;
  lastWebhookAt: string | null;
  webhookStatus: "unknown" | "healthy" | "failing";
  envPresent: boolean;
  note: string;
};

const PROVIDER_ENV_KEYS: Record<string, string[]> = {
  stripe: ["STRIPE_API_KEY"],
  paypal: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"],
  aftership: ["AFTERSHIP_API_KEY"],
  nango: ["NANGO_API_KEY"],
  pancake_pos: ["PANCAKE_POS_API_KEY"],
};

const SDK_VERSIONS: Record<string, string> = {
  stripe:
    "stripe (Checkout Session provider in apps/medusa/src/modules/stripe-checkout-payment)",
  paypal: "@paypal/paypal-server-sdk",
  aftership: "@aftership/tracking-sdk",
  nango: "@nangohq/node",
  pancake_pos: "Pancake POS Open API (server-side REST)",
};

export async function GET(request: Request) {
  const auth = await requireStaffApiSession("settings:read");
  if (!auth.ok) return auth.response;

  const supabase = adminSupabaseOr503(getCorrelationId(request));
  if ("response" in supabase) return supabase.response;
  const organization = await resolveStaffOrganization(supabase.client, auth.session.user?.email);
  const { data: connections } = organization
    ? await supabase.client
        .from("payment_nango_connections")
        .select("provider")
        .eq("organization_id", organization.id)
        .eq("active", true)
    : { data: [] as Array<{ provider: string | null }> };
  const connectedProviders = new Set((connections ?? []).map((item) => item.provider));
  const providerConfigured = (provider: string, envKeys: string[]) => {
    if (provider === "stripe") {
      return connectedProviders.has("stripe");
    }
    if (provider === "paypal") {
      return connectedProviders.has("paypal");
    }
    return envKeys.every((k) => Boolean(process.env[k]?.trim()));
  };

  const entries: IntegrationHealthEntry[] = Object.keys(PROVIDER_ENV_KEYS).map(
    (provider) => {
      const envKeys = PROVIDER_ENV_KEYS[provider] ?? [];
      const envPresent = providerConfigured(provider, envKeys);

      const status: IntegrationHealthEntry["status"] = envPresent
        ? "healthy"
        : "unconfigured";
      const note = envPresent
        ? provider === "stripe" || provider === "paypal"
          ? "Organization-scoped Nango merchant connection is active."
          : "Env keys present for this app process (Medusa may use its own env)."
        : `Missing env: ${envKeys.join(", ")}`;

      return {
        provider,
        status,
        sdkVersion: SDK_VERSIONS[provider] ?? null,
        lastWebhookAt: null,
        webhookStatus: "unknown" as const,
        envPresent,
        note,
      };
    },
  );

  return NextResponse.json({ entries });
}
