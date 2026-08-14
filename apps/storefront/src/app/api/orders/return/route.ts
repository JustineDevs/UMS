import {
  enqueueJob,
  insertCustomerReturnRequestAudit,
} from "@universal-music-store/platform-data";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { medusaAdminFetch } from "@/lib/medusa-admin-fetch";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import { storefrontReturnRequestBodySchema } from "@universal-music-store/validation";

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
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`order-return:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return jsonNoStore(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = storefrontReturnRequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonNoStore(
      { error: "Invalid return payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { orderId, items, note } = parsed.data;

  const orderRes = await medusaAdminFetch(
    `/admin/orders/${encodeURIComponent(orderId)}?fields=id,email`,
  );
  if (!orderRes.ok) {
    return jsonNoStore({ error: "Order not found" }, { status: 404 });
  }
  const orderJson = (await orderRes.json()) as {
    order?: { email?: string | null };
  };
  const orderEmail = orderJson.order?.email?.trim().toLowerCase();
  if (!orderEmail || orderEmail !== email) {
    return jsonNoStore({ error: "Forbidden" }, { status: 403 });
  }

  const payload: Record<string, unknown> = {
    items: items.map((it) => ({
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
      body: JSON.stringify(payload),
    },
  );

  if (!returnRes.ok) {
    const t = await returnRes.text().catch(() => "");
    return jsonNoStore(
      { error: "Return request failed", detail: t.slice(0, 300) },
      { status: 502 },
    );
  }

  const data = (await returnRes.json()) as unknown;

  const sb = createStorefrontServiceSupabase();
  let staffJobId: string | null = null;
  if (sb) {
    staffJobId = await enqueueJob(
      sb,
      "return_request_review",
      { order_id: orderId, email },
      "storefront_return",
    ).catch(() => null);
    await insertCustomerReturnRequestAudit(sb, {
      medusaOrderId: orderId,
      customerEmail: email,
      items: items.map((it) => ({ ...it })),
      note: note ?? null,
      medusaResponse: data,
      staffReviewJobId: staffJobId,
    }).catch(() => {});
  }

  return jsonNoStore({ ok: true, data });
}
