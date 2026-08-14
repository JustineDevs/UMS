import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { calculatePosReconciliation, closeShift, getShiftById, listVoids } from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { medusaAdminFetch } from "@/lib/medusa-admin-http";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };
const closeShiftSchema = z.object({
  closing_cash: z.number().finite().nonnegative(),
  notes: z.string().trim().max(1000).optional(),
}).strict();

async function post(req: NextRequest, ctx: Ctx) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "pos:shift_manage")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const idempotencyKey = req.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey) return correlatedJson(cid, { error: "Idempotency-Key is required" }, { status: 400 });
  let rawBody: unknown;
  try { rawBody = await req.json(); } catch { return correlatedJson(cid, { error: "Invalid JSON" }, { status: 400 }); }
  const parsed = closeShiftSchema.safeParse(rawBody);
  if (!parsed.success) return correlatedJson(cid, { error: "Invalid shift close payload" }, { status: 400 });
  const body = parsed.data;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const organization = await resolveStaffOrganization(sb, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const existing = await sb.from("pos_shift_reconciliations").select("*").eq("shift_id", id).eq("organization_id", organization.id).maybeSingle();
  if (existing.error && !/relation .* does not exist/i.test(existing.error.message)) return correlatedJson(cid, { error: "Unable to load reconciliation" }, { status: 503 });
  if (existing.data) {
    if (existing.data.idempotency_key !== idempotencyKey) return correlatedJson(cid, { error: "Shift already reconciled" }, { status: 409 });
    return correlatedJson(cid, { data: { reconciliation: existing.data } });
  }
  const currentShift = await getShiftById(sb, id, organization.id);
  if (!currentShift) return correlatedJson(cid, { error: "Shift not found" }, { status: 404 });
  let cashSales = 0;
  for (let offset = 0; offset < 5000; offset += 50) {
    const query = new URLSearchParams({ limit: "50", offset: String(offset), fields: "id,total,metadata", order: "-created_at" });
    const response = await medusaAdminFetch(`/admin/orders?${query.toString()}`, { method: "GET" });
    if (!response.ok) return correlatedJson(cid, { error: "Unable to load shift sales" }, { status: 503 });
    const orders = ((await response.json()) as { orders?: Array<{ total?: unknown; metadata?: Record<string, unknown> | null }> }).orders ?? [];
    for (const order of orders) {
      if (String(order.metadata?.pos_shift_id ?? "") !== id) continue;
      const total = Number(order.total ?? 0);
      if (Number.isFinite(total) && total >= 0) cashSales += Math.round(total);
    }
    if (orders.length < 50) break;
  }
  const voids = await listVoids(sb, { shiftId: id, limit: 200, organizationId: organization.id });
  const cashRefunds = voids.reduce((sum, value) => sum + Math.max(0, Math.round(value.amount ?? 0)), 0);
  const reconciliation = calculatePosReconciliation({ openingCash: currentShift.opening_cash, cashSales, cashRefunds, payouts: 0, countedCash: body.closing_cash });
  const shift = await closeShift(sb, id, { organization_id: organization.id, closing_cash: body.closing_cash, expected_cash: reconciliation.expectedCash, notes: body.notes });
  const result = await sb.from("pos_shift_reconciliations").upsert({ organization_id: organization.id, shift_id: id, idempotency_key: idempotencyKey, opening_cash: reconciliation.openingCash, cash_sales: reconciliation.cashSales, cash_refunds: reconciliation.cashRefunds, payouts: reconciliation.payouts, expected_cash: reconciliation.expectedCash, counted_cash: reconciliation.countedCash, variance: reconciliation.variance, created_by_email: session.user.email?.trim().toLowerCase() ?? "system" }, { onConflict: "shift_id" }).select("*").single();
  if (result.error) return correlatedJson(cid, { error: "Unable to persist reconciliation" }, { status: 503 });
  return correlatedJson(cid, { data: { shift, reconciliation: result.data } });
}

export const POST = withAdminMutationIdempotency("/admin/shifts/[id]/close:POST", post);
