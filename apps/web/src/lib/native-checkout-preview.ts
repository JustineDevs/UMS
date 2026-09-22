import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { isSameOriginMutation } from "@/lib/request-origin";
import { checkoutPreviewResponseSchema } from "@/lib/admin-api-contracts";
import { readResponseJson } from "@/lib/read-response-json";

/**
 * Proxy the storefront checkout quote to the Worker commerce authority.
 * This route deliberately has no Medusa fallback: an unavailable Worker is
 * surfaced as an unavailable quote instead of showing a potentially stale
 * client-side or legacy total.
 */
export async function handleNativeCheckoutPreview(req: Request): Promise<Response> {
  if (!isSameOriginMutation(req)) {
    return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }

  const rl = await rateLimitFixedWindow(
    `native-checkout-preview:${getRequestIp(req)}`,
    30,
    60_000,
  );
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const apiUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!apiUrl) {
    return Response.json({ error: "Checkout preview is temporarily unavailable." }, { status: 503 });
  }

  try {
    const response = await fetch(`${apiUrl}/store/checkout/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: await req.clone().text(),
      cache: "no-store",
    });
    if (response.ok) {
      const parsed = await readResponseJson<unknown>(response, null);
      const validated = checkoutPreviewResponseSchema.safeParse(parsed);
      if (!validated.success) return Response.json({ error: "Checkout preview returned an invalid quote" }, { status: 502 });
      return Response.json(validated.data, { status: response.status, headers: { "Cache-Control": "no-store" } });
    }
    const errorPayload = await readResponseJson<unknown>(response, { error: "Checkout preview failed" });
    return Response.json(errorPayload, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "Checkout preview is temporarily unavailable." }, { status: 503 });
  }
}
