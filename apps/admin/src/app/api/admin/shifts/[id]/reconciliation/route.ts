import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { listVoids, getShiftById } from "@universal-music-store/platform-data";
import { staffSessionAllows } from "@universal-music-store/database";
import { medusaAdminFetch } from "@/lib/medusa-admin-http";
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

  let ordersMatched = 0;
  let salesTotalMinor = 0;
  const pageSize = 50;
  for (let offset = 0; offset < 5000; offset += pageSize) {
    const qs = new URLSearchParams();
    qs.set("limit", String(pageSize));
    qs.set("offset", String(offset));
    qs.set("fields", "id,total,metadata");
    qs.set("order", "-created_at");
    const res = await medusaAdminFetch(`/admin/orders?${qs.toString()}`, {
      method: "GET",
    });
    if (!res.ok) break;
    const json = (await res.json()) as {
      orders?: Array<{ total?: unknown; metadata?: Record<string, unknown> | null }>;
    };
    const orders = json.orders ?? [];
    if (orders.length === 0) break;
    for (const o of orders) {
      const sid = o.metadata?.pos_shift_id;
      if (sid != null && String(sid) === shiftId.trim()) {
        ordersMatched += 1;
        const t = o.total;
        const n =
          typeof t === "bigint"
            ? Number(t)
            : typeof t === "number"
              ? t
              : Number(t ?? 0);
        if (Number.isFinite(n)) salesTotalMinor += Math.round(n);
      }
    }
    if (orders.length < pageSize) break;
  }

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
