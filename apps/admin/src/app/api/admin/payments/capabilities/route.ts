import {
  getPaymentProviderCapabilities,
  type PaymentProvider,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import {
  stripeAvailableForMerchant,
  STRIPE_UNAVAILABLE_IN_MERCHANT_COUNTRY,
} from "@/lib/payment-country-policy";

export const dynamic = "force-dynamic";
const providers = [
  "stripe",
  "paypal",
  "xendit",
] as const satisfies readonly PaymentProvider[];

export async function GET(req: Request) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("settings:read");
  if (!staff.ok) return staff.response;
  const supabase = adminSupabaseOr503(correlationId);
  if ("response" in supabase) return supabase.response;
  const organization = await resolveStaffOrganization(
    supabase.client,
    staff.session.user?.email,
  );
  if (!organization)
    return correlatedJson(
      correlationId,
      { error: "Organization membership is not configured" },
      { status: 403 },
    );
  const { data: connections } = await supabase.client
    .from("payment_nango_connections")
    .select("provider_config_key,active,merchant_identity")
    .eq("organization_id", organization.id)
    .eq("active", true);
  const connected = new Set(
    (connections ?? []).map((row) => String(row.provider_config_key)),
  );
  return correlatedJson(correlationId, {
    data: providers.map((provider) => ({
      ...getPaymentProviderCapabilities(provider),
      configured:
        (provider !== "stripe" || stripeAvailableForMerchant()) &&
        (connected.has(provider) ||
          connected.has(`${provider}-sandbox`) ||
          (provider === "xendit" &&
            Boolean(
              process.env.XENDIT_SECRET_KEY?.trim() &&
                process.env.XENDIT_WEBHOOK_TOKEN?.trim(),
            ))),
      policy:
        provider === "stripe" && !stripeAvailableForMerchant()
          ? { locked: true, code: STRIPE_UNAVAILABLE_IN_MERCHANT_COUNTRY }
          : { locked: false },
      unavailableInUvs: getPaymentProviderCapabilities(
        provider,
      ).capabilities.filter(
        (capability) =>
          !getPaymentProviderCapabilities(
            provider,
          ).implementedCapabilities.includes(capability),
      ),
    })),
  });
}
