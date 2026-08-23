import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { medusaAdminFetch } from "@/lib/medusa-admin-http";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { parseBoundedJson } from "@/lib/bounded-request-body";

const MAX_CONCURRENCY = 3;

type BulkFulfillBody = {
  orderIds: string[];
  trackingNumber?: string;
  carrierId?: string;
  notifyCustomer?: boolean;
};

type FulfillResult = {
  orderId: string;
  ok: boolean;
  error?: string;
};

async function fulfillOrder(
  orderId: string,
  opts: { trackingNumber?: string; carrierId?: string; notifyCustomer?: boolean },
): Promise<FulfillResult> {
  try {
    const orderRes = await medusaAdminFetch(`/admin/orders/${encodeURIComponent(orderId)}`, {
      method: "GET",
    });
    if (!orderRes.ok) {
      return { orderId, ok: false, error: `Order fetch failed: ${orderRes.status}` };
    }
    const orderJson = (await orderRes.json()) as { order?: Record<string, unknown> };
    const order = orderJson.order ?? {};

    if (order.fulfillment_status === "fulfilled" || order.fulfillment_status === "shipped") {
      return { orderId, ok: true, error: "Already fulfilled" };
    }

    const items = Array.isArray(order.items) ? order.items as Array<Record<string, unknown>> : [];
    const fulfillItems = items
      .filter((i) => Number(i.quantity ?? 0) > Number(i.fulfilled_quantity ?? 0))
      .map((i) => ({
        id: String(i.id),
        quantity: Number(i.quantity ?? 1) - Number(i.fulfilled_quantity ?? 0),
      }));

    if (fulfillItems.length === 0) {
      return { orderId, ok: true, error: "No items to fulfill" };
    }

    const fulfillBody: Record<string, unknown> = {
      items: fulfillItems,
      no_notification: !opts.notifyCustomer,
    };

    const fulfillRes = await medusaAdminFetch(
      `/admin/orders/${encodeURIComponent(orderId)}/fulfillments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fulfillBody),
      },
    );

    if (!fulfillRes.ok) {
      const errText = await fulfillRes.text().catch(() => fulfillRes.status.toString());
      return { orderId, ok: false, error: `Fulfill failed: ${errText}` };
    }

    const fulfillJson = (await fulfillRes.json()) as {
      order?: { fulfillments?: Array<{ id: string }> };
    };

    if (opts.trackingNumber) {
      const fulfillmentId = fulfillJson.order?.fulfillments?.[0]?.id;
      if (fulfillmentId) {
        await medusaAdminFetch(
          `/admin/orders/${encodeURIComponent(orderId)}/fulfillments/${encodeURIComponent(fulfillmentId)}/shipments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tracking_numbers: [opts.trackingNumber],
            }),
          },
        ).catch(() => null);
      }
    }

    return { orderId, ok: true };
  } catch (err) {
    return {
      orderId,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "orders:fulfill")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }

  const parsedBody = await parseBoundedJson(req, 64 * 1024);
  if (parsedBody.tooLarge) return correlatedJson(cid, { error: "Payload too large" }, { status: 413 });
  if (!parsedBody.valid || !parsedBody.value || typeof parsedBody.value !== "object" || Array.isArray(parsedBody.value)) {
    return correlatedJson(cid, { error: "Invalid JSON" }, { status: 400 });
  }
  const body = parsedBody.value as BulkFulfillBody;

  const { orderIds, trackingNumber, carrierId, notifyCustomer = true } = body;

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return correlatedJson(cid, { error: "orderIds must be a non-empty array" }, { status: 400 });
  }
  if (orderIds.length > 100) {
    return correlatedJson(cid, { error: "Maximum 100 orders per bulk request" }, { status: 400 });
  }

  const results: FulfillResult[] = [];

  for (let i = 0; i < orderIds.length; i += MAX_CONCURRENCY) {
    const chunk = orderIds.slice(i, i + MAX_CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map((id) =>
        fulfillOrder(id, { trackingNumber, carrierId, notifyCustomer }),
      ),
    );
    results.push(...chunkResults);
  }

  const succeeded = results.filter((r) => r.ok && !r.error?.includes("Already")).map((r) => r.orderId);
  const failed = results.filter((r) => !r.ok);
  const skipped = results.filter((r) => r.ok && r.error);

  const sup = adminSupabaseOr503(cid);
  if (!("response" in sup)) {
    const staffEmail = session.user.email ?? "unknown";
    await sup.client
      .from("audit_log")
      .insert({
        actor_email: staffEmail,
        action: "bulk_fulfill",
        resource_type: "order",
        resource_ids: orderIds,
        metadata: {
          succeeded: succeeded.length,
          failed: failed.length,
          skipped: skipped.length,
          trackingNumber: trackingNumber ?? null,
        },
      })
      .then(
        () => null,
        () => null,
      );
  }

  return correlatedJson(cid, {
    total: orderIds.length,
    succeeded: succeeded.length,
    failed: failed.length,
    skipped: skipped.length,
    results,
  });
}

export const POST = withAdminMutationIdempotency("/admin/orders/bulk-fulfill:POST", post);
