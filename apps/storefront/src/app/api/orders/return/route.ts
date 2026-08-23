import {
  enqueueJob,
  insertCustomerReturnRequestAudit,
} from "@universal-music-store/platform-data";
import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { getStorefrontSession } from "@/lib/auth";
import { medusaAdminFetch } from "@/lib/medusa-admin-fetch";
import { accountOrderMatchesCustomer } from "@/lib/medusa-account-orders";
import { findMedusaCustomerIdByEmail } from "@/lib/medusa-customer-resolve";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import { storefrontReturnRequestBodySchema } from "@universal-music-store/validation";
import { isSameOriginMutation } from "@/lib/request-origin";
import { accountMutationFailure } from "@/lib/account-mutation-error";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import {
  evaluateReturnableOrderStatus,
  normalizeReturnRequestLines,
  validateReturnRequestLines,
} from "@/lib/account-return-policy";

const MAX_RETURN_BODY_BYTES = 32 * 1024;

function jsonNoStore(
  body: unknown,
  init?: Parameters<typeof NextResponse.json>[1],
): NextResponse<unknown> {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...(init?.headers ?? {}),
    },
  });
}

export async function POST(req: Request) {
  if (!isSameOriginMutation(req)) {
    return jsonNoStore(
      { error: "Cross-site mutation rejected" },
      { status: 403 },
    );
  }
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`order-return:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return jsonNoStore(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const session = await getStorefrontSession();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }
  const customerId = await findMedusaCustomerIdByEmail(email);

  const bounded = await parseBoundedJson(req, MAX_RETURN_BODY_BYTES);
  if (bounded.tooLarge) {
    return jsonNoStore({ error: "Request body is too large" }, { status: 413 });
  }
  if (!bounded.valid) {
    return jsonNoStore({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = bounded.value;
  const parsed = storefrontReturnRequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonNoStore(
      { error: "Invalid return payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { orderId, items, note } = parsed.data;
  const itemIds = new Set(items.map((item) => item.item_id));
  if (itemIds.size !== items.length) {
    return jsonNoStore(
      { error: "Duplicate return lines are not allowed" },
      { status: 400 },
    );
  }
  const normalizedItems = normalizeReturnRequestLines(items);

  const orderRes = await medusaAdminFetch(
    `/admin/orders/${encodeURIComponent(orderId)}?fields=id,email,customer_id,status,*items,*items.id,*items.quantity,*items.returned_quantity`,
  );
  if (!orderRes.ok) {
    if (
      orderRes.status >= 500 ||
      orderRes.status === 408 ||
      orderRes.status === 429
    ) {
      const correlationId = crypto.randomUUID();
      console.error("Medusa return order lookup failed", {
        correlationId,
        status: orderRes.status,
      });
      return jsonNoStore(
        accountMutationFailure(
          "Could not load the order right now.",
          correlationId,
        ),
        { status: 503 },
      );
    }
    return jsonNoStore({ error: "Order not found" }, { status: 404 });
  }
  const orderJson = (await orderRes.json()) as {
    order?: {
      email?: string | null;
      customer_id?: string | null;
      status?: string | null;
      items?: Array<{
        id?: unknown;
        quantity?: unknown;
        returned_quantity?: unknown;
      }>;
    };
  };
  const orderEmail = orderJson.order?.email?.trim().toLowerCase();
  const ownedByCustomer = customerId
    ? accountOrderMatchesCustomer(orderJson.order?.customer_id, customerId)
    : Boolean(orderEmail && orderEmail === email);
  if (!ownedByCustomer) {
    return jsonNoStore({ error: "Forbidden" }, { status: 403 });
  }

  const returnPolicy = evaluateReturnableOrderStatus(orderJson.order?.status);
  if (!returnPolicy.ok) {
    return jsonNoStore(
      {
        error:
          returnPolicy.reason === "unknown_status"
            ? "This order cannot be returned until its fulfillment status is confirmed."
            : "This order is not eligible for a return.",
        code:
          returnPolicy.reason === "unknown_status"
            ? "RETURN_STATUS_UNAVAILABLE"
            : "RETURN_NOT_ELIGIBLE",
      },
      { status: 409 },
    );
  }

  const lineValidation = validateReturnRequestLines(
    items,
    orderJson.order?.items ?? [],
  );
  if (!lineValidation.ok) {
    return jsonNoStore(
      {
        error:
          lineValidation.reason === "unknown_item"
            ? "One or more return items are not part of this order."
            : "The requested return quantity exceeds the quantity still available.",
        code: "RETURN_LINES_INVALID",
      },
      { status: 409 },
    );
  }

  const payload: Record<string, unknown> = {
    items: normalizedItems.map((it) => ({
      item_id: it.item_id,
      quantity: it.quantity,
      ...(it.reason_id ? { reason_id: it.reason_id } : {}),
      ...(it.note ? { note: it.note } : {}),
    })),
  };
  if (note) {
    payload.note = note;
  }

  const returnRes = await medusaAdminFetch(
    `/admin/orders/${encodeURIComponent(orderId)}/return`,
    {
      method: "POST",
      headers: {
        "Idempotency-Key": createHash("sha256")
          .update(`order-return:${email}:${orderId}:${JSON.stringify(payload)}`)
          .digest("hex"),
      },
      body: JSON.stringify(payload),
    },
  );

  if (!returnRes.ok) {
    const t = await returnRes.text().catch(() => "");
    const correlationId = crypto.randomUUID();
    console.error("Medusa return request failed", {
      correlationId,
      status: returnRes.status,
      detailLength: t.length,
    });
    return jsonNoStore(
      accountMutationFailure(
        "Return request failed. Please try again or contact support.",
        correlationId,
      ),
      { status: 502 },
    );
  }

  const data = (await returnRes.json()) as unknown;

  const sb = createStorefrontServiceSupabase();
  let staffJobId: string | null = null;
  let auditPending = false;
  if (sb) {
    staffJobId = await enqueueJob(
      sb,
      "return_request_review",
      { order_id: orderId, email },
      "storefront_return",
    ).catch(() => null);
    if (!staffJobId) auditPending = true;
    const auditId = await insertCustomerReturnRequestAudit(sb, {
      medusaOrderId: orderId,
      customerEmail: email,
      items: normalizedItems.map((it) => ({ ...it })),
      note: note ?? null,
      medusaResponse: data,
      staffReviewJobId: staffJobId,
    }).catch(() => null);
    if (!auditId) auditPending = true;
  } else {
    auditPending = true;
  }

  return jsonNoStore({
    ok: true,
    data,
    auditStatus: auditPending ? "pending" : "recorded",
  });
}
