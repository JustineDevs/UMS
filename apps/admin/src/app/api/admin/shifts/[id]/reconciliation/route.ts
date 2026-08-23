import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { listVoids, getShiftById } from "@universal-music-store/platform-data";
import { staffSessionAllows } from "@universal-music-store/database";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Register-grade shift reconciliation: sums Medusa orders tagged with metadata.pos_shift_id
 * and lists void rows for the shift.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(correlationId, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "pos:use")) {
    return correlatedJson(correlationId, { error: "Forbidden" }, { status: 403 });
  }

  const { id: shiftId } = await ctx.params;
  if (!shiftId?.trim()) {
    return correlatedJson(correlationId, { error: "Missing shift id" }, { status: 400 });
  }

  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(correlationId, { error: "Organization membership is not configured" }, { status: 403 });

  const shift = await getShiftById(sup.client, shiftId.trim(), organization.id);
  if (!shift) {
    return correlatedJson(correlationId, { error: "Shift not found" }, { status: 404 });
  }

  const voids = await listVoids(sup.client, { shiftId: shiftId.trim(), limit: 200, organizationId: organization.id });
  const voidAmountMinor = voids.reduce((s, v) => s + (v.amount != null ? Math.round(v.amount) : 0), 0);

  const sales = await sup.client.from("pos_sale_ledger").select("order_id,total_minor,payment_method").eq("organization_id", organization.id).eq("shift_id", shiftId.trim());
  if (sales.error) return correlatedJson(correlationId, { error: "Unable to load shift sales" }, { status: 503 });
  const ordersMatched = sales.data?.length ?? 0;
  const salesTotalMinor = (sales.data ?? []).reduce((sum, sale) => sale.payment_method === "cash" ? sum + Math.max(0, Number(sale.total_minor ?? 0)) : sum, 0);

  const openingCash = shift.opening_cash;
  const closingCash = shift.closing_cash;
  const expectedCash = shift.expected_cash;

  return correlatedJson(correlationId, {
    shift,
    voids,
    voidCount: voids.length,
    voidAmountMinor,
    medusaOrdersForShift: ordersMatched,
    medusaSalesTotalMinor: salesTotalMinor,
    openingCash,
    closingCash,
    expectedCash,
    cashVariance:
      closingCash != null && expectedCash != null
        ? closingCash - expectedCash
        : null,
  });
}
