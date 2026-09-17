import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { getStorefrontSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import { storefrontReturnRequestBodySchema } from "@universal-music-store/validation";
import { isSameOriginMutation } from "@/lib/request-origin";
import { accountMutationFailure } from "@/lib/account-mutation-error";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { normalizeReturnRequestLines } from "@/lib/account-return-policy";

const MAX_RETURN_BODY_BYTES = 32 * 1024;

function jsonNoStore(
  body: unknown,
  init?: Parameters<typeof NextResponse.json>[1],
) {
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
  const rl = await rateLimitFixedWindow(
    `order-return:${getRequestIp(req)}`,
    10,
    60_000,
  );
  if (!rl.ok) {
    return jsonNoStore(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }
  const bounded = await parseBoundedJson(req, MAX_RETURN_BODY_BYTES);
  if (bounded.tooLarge)
    return jsonNoStore({ error: "Request body is too large" }, { status: 413 });
  if (!bounded.valid)
    return jsonNoStore({ error: "Invalid JSON" }, { status: 400 });
  const parsed = storefrontReturnRequestBodySchema.safeParse(bounded.value);
  if (!parsed.success)
    return jsonNoStore({ error: "Invalid return payload" }, { status: 400 });

  const { orderId, items, note } = parsed.data;
  if (new Set(items.map((item) => item.item_id)).size !== items.length) {
    return jsonNoStore(
      { error: "Duplicate return lines are not allowed" },
      { status: 400 },
    );
  }
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!base)
    return jsonNoStore(
      { error: "Worker API is not configured for returns." },
      { status: 503 },
    );

  try {
    const session = await getStorefrontSession();
    if (!session?.user?.email?.trim())
      return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
    const supabase = await createSupabaseServerClient();
    const [{ data: userData }, { data: sessionData }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ]);
    const email = userData.user?.email?.trim().toLowerCase();
    const accessToken = sessionData.session?.access_token?.trim();
    if (!email || !accessToken)
      return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

    const payload = {
      orderId,
      items: normalizeReturnRequestLines(items).map((item) => ({
        item_id: item.item_id,
        quantity: item.quantity,
        ...(item.reason_id ? { reason_id: item.reason_id } : {}),
        ...(item.note ? { note: item.note } : {}),
      })),
      ...(note ? { note } : {}),
    };
    const idempotencyKey = createHash("sha256")
      .update(`order-return:${email}:${orderId}:${JSON.stringify(payload)}`)
      .digest("hex");
    const response = await fetch(`${base}/store/orders/return`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const body = await response
      .json()
      .catch(() => ({ error: "invalid_worker_response" }));
    return jsonNoStore(body, { status: response.status });
  } catch (error) {
    const correlationId = crypto.randomUUID();
    console.error("Worker return request failed", {
      correlationId,
      error: error instanceof Error ? error.name : "unknown",
    });
    return jsonNoStore(
      accountMutationFailure(
        "Return request failed. Please try again or contact support.",
        correlationId,
      ),
      { status: 503 },
    );
  }
}
