import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminCostVisibilityResponseSchema } from "@/lib/admin-api-contracts";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";
import { getCorrelationId } from "@/lib/request-correlation";

export type CostLineItem = {
  service: string;
  category: "hosting" | "database" | "cache" | "psp_fees" | "email" | "tracking" | "cdn" | "other";
  monthlyCostPhp: number | null;
  costStatus: "not_configured" | "estimated" | "verified";
  note: string;
};

export type CostVisibilitySummary = {
  month: string;
  dataStatus: "not_configured" | "partial" | "verified";
  totalMonthlyCostPhp: number | null;
  items: CostLineItem[];
  breakdown: Record<string, number>;
};

const COST_ITEMS: CostLineItem[] = [
  { service: "Vercel unified web application", category: "hosting", monthlyCostPhp: null, costStatus: "not_configured", note: "Billing data is not connected; no cost estimate is asserted." },
  { service: "Cloudflare Workers backend", category: "hosting", monthlyCostPhp: null, costStatus: "not_configured", note: "Billing data is not connected; the backend is Worker-only with no container runtime." },
  { service: "Supabase Cloud PostgreSQL and Auth", category: "database", monthlyCostPhp: null, costStatus: "not_configured", note: "Billing data is not connected." },
  { service: "Upstash Redis", category: "cache", monthlyCostPhp: null, costStatus: "not_configured", note: "Billing data is not connected." },
  { service: "Stripe", category: "psp_fees", monthlyCostPhp: null, costStatus: "not_configured", note: "Provider fees depend on verified transaction volume and account pricing." },
  { service: "PayPal", category: "psp_fees", monthlyCostPhp: null, costStatus: "not_configured", note: "Provider fees depend on verified transaction volume and account pricing." },
  { service: "Resend", category: "email", monthlyCostPhp: null, costStatus: "not_configured", note: "Billing data is not connected." },
  { service: "AfterShip", category: "tracking", monthlyCostPhp: null, costStatus: "not_configured", note: "Billing data is not connected and the integration may be unconfigured." },
];

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("dashboard:read");
  if (!staff.ok) return staff.response;

  const items = COST_ITEMS;

  const breakdown: Record<string, number> = {};
  for (const item of items) {
    if (item.monthlyCostPhp != null) breakdown[item.category] = (breakdown[item.category] ?? 0) + item.monthlyCostPhp;
  }

  const summary: CostVisibilitySummary = {
    month: new Date().toISOString().slice(0, 7),
    dataStatus: "not_configured",
    totalMonthlyCostPhp: null,
    items,
    breakdown,
  };

  const parsed = adminCostVisibilityResponseSchema.safeParse(summary);
  if (!parsed.success) return correlatedError(correlationId, 500, "Cost visibility response is invalid", "INTERNAL_ERROR");
  return correlatedJson(correlationId, parsed.data);
}
