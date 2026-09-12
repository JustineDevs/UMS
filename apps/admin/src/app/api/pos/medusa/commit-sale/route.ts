import { evaluatePosSalePolicy } from "@universal-music-store/omnichannel-policy";
import { getShiftById } from "@universal-music-store/platform-data";
import { claimPosSaleCommand, completePosSaleCommand } from "@universal-music-store/platform-data";
import { logAdminApiEvent } from "@/lib/admin-api-log";
import { medusaAdminFetch } from "@/lib/medusa-admin-http";
import { patchMedusaOrderMetadata } from "@/lib/medusa-order-bridge";
import {
  getCompletedPosCommitOrderNumber,
  rememberCompletedPosCommit,
} from "@/lib/pos-commit-idempotency";
import { handlePosCommitSaleRequest } from "@/lib/pos-commit-sale-route-handler";
import { assertPosCartStock } from "@/lib/pos-inventory-guard";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import {
  getMedusaAdminSdk,
  getMedusaRegionId,
  getMedusaSalesChannelId,
} from "@/lib/medusa-pos";
import { posCommitSaleRouteLogic } from "@/lib/pos-commit-sale-route-logic";
import { requireStaffApiSession } from "@/lib/requireStaffSession";

const inflight = new Map<string, number>();
const INFLIGHT_TTL_MS = 30_000;
const INFLIGHT_MAX = 5_000;

function pruneInflight(): void {
  if (inflight.size < INFLIGHT_MAX) return;
  const now = Date.now();
  for (const [k, ts] of inflight) {
    if (now - ts > INFLIGHT_TTL_MS) inflight.delete(k);
  }
}

async function findOrderByPosOfflineId(
  offlineSaleId: string,
  organizationId: string,
): Promise<{ display_id: unknown; id: string; total?: unknown } | null> {
  const pageSize = 50;
  for (let offset = 0; offset < 200; offset += pageSize) {
    const qs = new URLSearchParams();
    qs.set("limit", String(pageSize));
    qs.set("offset", String(offset));
    qs.set("fields", "id,display_id,total,metadata");
    qs.set("order", "-created_at");
    const res = await medusaAdminFetch(`/admin/orders?${qs.toString()}`);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      orders?: Array<{
        id?: string;
        display_id?: unknown;
        total?: unknown;
        metadata?: Record<string, unknown> | null;
      }>;
    };
    const orders = json.orders ?? [];
    for (const o of orders) {
      if (
        o.metadata?.pos_offline_id === offlineSaleId &&
        o.metadata?.organization_id === organizationId &&
        o.id
      ) {
        return { id: o.id, display_id: o.display_id, total: o.total };
      }
    }
    if (orders.length < pageSize) break;
  }
  return null;
}

async function findOrderByPosMetadata(
  field: "pos_offline_id" | "pos_idempotency_key",
  value: string,
  organizationId: string,
): Promise<{ display_id: unknown; id: string; total?: unknown } | null> {
  const pageSize = 50;
  for (let offset = 0; offset < 200; offset += pageSize) {
    const qs = new URLSearchParams({ limit: String(pageSize), offset: String(offset), fields: "id,display_id,total,metadata", order: "-created_at" });
    const res = await medusaAdminFetch(`/admin/orders?${qs.toString()}`);
    if (!res.ok) return null;
    const orders = ((await res.json()) as { orders?: Array<{ id?: string; display_id?: unknown; total?: unknown; metadata?: Record<string, unknown> | null }> }).orders ?? [];
    const found = orders.find((order) => order.id && order.metadata?.[field] === value && order.metadata?.organization_id === organizationId);
    if (found?.id) return { id: found.id, display_id: found.display_id, total: found.total };
    if (orders.length < pageSize) break;
  }
  return null;
}

export async function POST(req: Request) {
  const adminSdk = getMedusaAdminSdk();
  const regionId = getMedusaRegionId();
  const salesChannelId = getMedusaSalesChannelId();
  return handlePosCommitSaleRequest(req, {
    getCorrelationId,
    requireStaffApiSession,
    resolveOrganizationId: async (correlationId) => {
      const sup = adminSupabaseOr503(correlationId);
      if ("response" in sup) return null;
      const staff = await requireStaffApiSession("pos:use");
      if (!staff.ok) return null;
      return (
        (await resolveStaffOrganization(sup.client, staff.session.user?.email))
          ?.id ?? null
      );
    },
    logAdminApiEvent,
    getIdempotencyKey: (request) =>
      request.headers.get("idempotency-key") ?? undefined,
    getCompletedReplayOrderNumber: (key) =>
      getCompletedPosCommitOrderNumber(key) ?? undefined,
    isInflight: (key) => {
      pruneInflight();
      return inflight.has(key);
    },
    startInflight: (key) => {
      inflight.set(key, Date.now());
    },
    clearInflight: (key) => {
      inflight.delete(key);
    },
    executeCommitSale: async ({
      body,
      correlationId,
      idempotencyKey,
      organizationId,
    }) => {
      if (!organizationId) {
        return {
          status: 403,
          body: { error: "Organization scope required", code: "FORBIDDEN" },
          logPhase: "error" as const,
          logDetail: { message: "Organization scope required" },
        };
      }
      try {
        return await posCommitSaleRouteLogic({
          body: {
            ...body,
            paymentMethod: body.paymentMethod ?? "cash",
            receiptReference:
              body.receiptReference?.trim() ||
              `pos:${idempotencyKey ?? correlationId}`,
          },
          correlationId,
          idempotencyKey,
          envReady: Boolean(adminSdk && regionId && salesChannelId),
          completedReplayOrderNumber: null,
          claimDurableCommand: async ({ idempotencyKey, offlineSaleId }) => {
            const sup = adminSupabaseOr503(correlationId);
            if ("response" in sup) throw new Error("SUPABASE_UNAVAILABLE");
            return claimPosSaleCommand(sup.client, { organizationId, idempotencyKey, offlineSaleId });
          },
          completeDurableCommand: async ({ idempotencyKey, orderId, orderNumber }) => {
            const sup = adminSupabaseOr503(correlationId);
            if ("response" in sup) throw new Error("SUPABASE_UNAVAILABLE");
            await completePosSaleCommand(sup.client, { organizationId, idempotencyKey, orderId, orderNumber });
          },
          findExistingOrderByOfflineSaleId: async (offlineSaleId) => {
            const existing = await findOrderByPosOfflineId(
              offlineSaleId,
              organizationId,
            );
            if (!existing) {
              return null;
            }
            return {
              id: existing.id,
              displayId:
                existing.display_id != null
                  ? String(existing.display_id)
                  : existing.id,
              totalMinor: Number(existing.total ?? 0),
            };
          },
          findExistingOrderByIdempotencyKey: async (key) => {
            const existing = await findOrderByPosMetadata("pos_idempotency_key", key, organizationId);
            return existing ? { id: existing.id, displayId: existing.display_id != null ? String(existing.display_id) : existing.id, totalMinor: Number(existing.total ?? 0) } : null;
          },
          assertStock: async (items) => assertPosCartStock(items),
          loadShiftStatus: async (shiftId) => {
            const sup = adminSupabaseOr503(correlationId);
            if ("response" in sup) {
              throw new Error("SUPABASE_UNAVAILABLE");
            }
            const row = await getShiftById(sup.client, shiftId, organizationId);
            return row?.status === "open" ? "open" : row ? "closed" : "missing";
          },
          assertTerminalReady: async (terminalId) => {
            const sup = adminSupabaseOr503(correlationId);
            if ("response" in sup) throw new Error("SUPABASE_UNAVAILABLE");
            const { data, error } = await sup.client
              .from("pos_payment_terminals")
              .select("status,certification_id")
              .eq("organization_id", organizationId)
              .eq("id", terminalId)
              .maybeSingle();
            if (error) throw new Error("POS_TERMINAL_LOOKUP_FAILED");
            return (
              data?.status === "certified" && Boolean(data.certification_id)
            );
          },
          evaluatePolicy: (policyInput) => evaluatePosSalePolicy(policyInput),
          createDraftOrder: async (draftInput) => {
            if (!adminSdk || !regionId || !salesChannelId) {
              return {};
            }
            const { draft_order } = await adminSdk.admin.draftOrder.create({
              email: draftInput.email,
              region_id: regionId,
              sales_channel_id: salesChannelId,
              items: draftInput.items,
              metadata: {
                ...(draftInput.metadata ?? {}),
                organization_id: organizationId,
              },
            } as never);
            return { id: draft_order?.id };
          },
          convertDraftToOrder: async (draftOrderId) => {
            if (!adminSdk) {
              return {};
            }
            const { order } =
              await adminSdk.admin.draftOrder.convertToOrder(draftOrderId);
            const total = (order as { total?: unknown } | undefined)?.total;
            return {
              id: order?.id != null ? String(order.id) : undefined,
              display_id: order?.display_id,
              total: typeof total === "number" ? total : undefined,
            };
          },
          patchOrderMetadata: async (orderId, metadata) => {
            await patchMedusaOrderMetadata(orderId, metadata);
          },
          recordSaleLedger: async ({
            orderId,
            orderNumber,
            shiftId,
            terminalId,
            totalMinor,
            idempotencyKey,
            paymentMethod,
          }) => {
            const sup = adminSupabaseOr503(correlationId);
            if ("response" in sup) return false;
            const { error } = await sup.client.from("pos_sale_ledger").upsert(
              {
                organization_id: organizationId,
                order_id: orderId,
                order_number: orderNumber,
                shift_id: shiftId ?? null,
                terminal_id: terminalId ?? null,
                total_minor: totalMinor,
                currency: "PHP",
                idempotency_key: idempotencyKey ?? null,
                payment_method: paymentMethod,
              },
              { onConflict: "organization_id,order_id" },
            );
            return !error;
          },
          rememberCompletedReplay: (key, orderNumber) => {
            rememberCompletedPosCommit(key, orderNumber);
          },
        });
      } catch (e) {
        const msg =
          e instanceof Error && e.message === "SUPABASE_UNAVAILABLE"
            ? "Supabase admin connection is not configured"
            : e instanceof Error
              ? e.message
              : "Unable to complete POS sale";
        return {
          status:
            msg === "Supabase admin connection is not configured" ? 503 : 502,
          body: {
            error: msg,
            code:
              msg === "Supabase admin connection is not configured"
                ? "SUPABASE_NOT_CONFIGURED"
                : "INTERNAL_ERROR",
          },
          logPhase: "error" as const,
          logDetail: { message: msg },
        };
      }
    },
  });
}
