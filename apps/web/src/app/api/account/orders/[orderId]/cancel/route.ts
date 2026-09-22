import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withBotIdProtection } from "@/lib/botid-protection";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import { isSameOriginMutation } from "@/lib/request-origin";
import { accountMutationFailure } from "@/lib/account-mutation-error";
import { buildOrderCancellationIdempotencyKey } from "@/lib/account-order-mutation";
import { accountOrderCancelResponseSchema } from "@/lib/admin-api-contracts";

export const runtime = "nodejs";

async function handlePOST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!isSameOriginMutation(_req)) {
    return NextResponse.json(
      { error: "Cross-site mutation rejected" },
      { status: 403 },
    );
  }
  const ip = getRequestIp(_req);
  const rl = await rateLimitFixedWindow(`order-cancel:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { orderId } = await params;
  const trimmedId = orderId.trim();

  const workerBaseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (workerBaseUrl) {
    try {
      const supabase = await createSupabaseServerClient();
      const [{ data: userData }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);
      const userEmail = userData.user?.email?.trim();
      const accessToken = sessionData.session?.access_token?.trim();
      if (!userEmail || !accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const idempotencyKey = buildOrderCancellationIdempotencyKey(
        userEmail,
        trimmedId,
      );
      const response = await fetch(
        `${workerBaseUrl}/store/customers/me/orders/${encodeURIComponent(trimmedId)}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
            Accept: "application/json",
          },
          body: "{}",
          cache: "no-store",
        },
      );
      if (!response.ok) {
        return NextResponse.json({ error: "Could not cancel the order right now." }, { status: response.status });
      }
      const body = await response
        .json()
        .catch(() => ({ error: "invalid_worker_response" }));
      const validated = accountOrderCancelResponseSchema.safeParse(body);
      if (!validated.success) return NextResponse.json({ error: "Order cancellation returned an invalid response" }, { status: 502 });
      return NextResponse.json(validated.data, { status: 200 });
    } catch (err) {
      const correlationId = crypto.randomUUID();
      console.error("Worker cancel order failed", {
        correlationId,
        error: err instanceof Error ? err.message : "unknown",
      });
      return NextResponse.json(
        accountMutationFailure(
          "Could not cancel the order right now.",
          correlationId,
        ),
        { status: 503 },
      );
    }
  }

  return NextResponse.json(
    { error: "Worker API is not configured for order cancellation." },
    { status: 503 },
  );
}

export const POST = withBotIdProtection(handlePOST);
