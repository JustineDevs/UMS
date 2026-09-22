import {
  getPublicOriginFromRequest,
  secureTrackingRedirectUrl,
} from "@/lib/finalize-checkout-server";
import { isSameOriginMutation } from "@/lib/request-origin";
import { readResponseJson } from "@/lib/read-response-json";
import { checkoutIntentFinalizeResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

/** Finalization is owned by the Worker; this route only preserves the storefront origin. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ correlationId: string }> },
): Promise<Response> {
  if (!isSameOriginMutation(req)) {
    return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }

  const workerBaseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!workerBaseUrl) {
    return Response.json({ error: "Checkout service is unavailable" }, { status: 503 });
  }

  const { correlationId } = await ctx.params;
  let workerResponse: Response;
  try {
    workerResponse = await fetch(
      `${workerBaseUrl}/store/checkout-intents/${encodeURIComponent(correlationId.trim())}/finalize`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...(req.headers.get("cookie") ? { Cookie: req.headers.get("cookie")! } : {}),
        },
        cache: "no-store",
        redirect: "error",
      },
    );
  } catch {
    return Response.json({ error: "Checkout service is unavailable" }, { status: 503 });
  }

  const payload = await readResponseJson<unknown>(workerResponse, null, { maxBytes: 32 * 1024 });
  if (!workerResponse.ok) {
    return Response.json(
      payload ?? { error: "Checkout finalization failed" },
      { status: workerResponse.status },
    );
  }

  if (!payload || typeof payload !== "object" || !("orderId" in payload) || typeof payload.orderId !== "string") {
    return Response.json({ error: "Checkout finalization returned an invalid response" }, { status: 502 });
  }

  const redirectUrl = secureTrackingRedirectUrl(
    "redirectUrl" in payload && typeof payload.redirectUrl === "string" ? payload.redirectUrl : undefined,
    payload.orderId,
    getPublicOriginFromRequest(req),
  );
  if (!redirectUrl) {
    return Response.json({ error: "Tracking capability is not configured" }, { status: 503 });
  }

  const parsed = checkoutIntentFinalizeResponseSchema.safeParse({ ...payload, redirectUrl });
  if (!parsed.success) {
    return Response.json({ error: "Checkout finalization returned an invalid response" }, { status: 502 });
  }
  return Response.json(parsed.data, { status: workerResponse.status });
}
