import { getStorefrontSession } from "@/lib/auth";
import {
  logCommerceObservabilityServer,
  isAllowedClientCommerceEvent,
  type CommerceObservabilityEvent,
} from "@/lib/commerce-observability";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { capturePostHogEvent } from "@universal-music-store/sdk";
import { isSameOriginMutation } from "@/lib/request-origin";
import { sanitizeCommerceObservabilityPayload } from "@/lib/commerce-observability";
import { parseBoundedJson } from "@/lib/bounded-request-body";

export const dynamic = "force-dynamic";

/**
 * Client-emitted commerce observability (authenticated shoppers only).
 */
export async function POST(req: Request) {
  if (!isSameOriginMutation(req)) {
    return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`commerce-telemetry:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const session = await getStorefrontSession();
  if (!session?.user?.email?.trim()) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedBody = await parseBoundedJson(req, 16 * 1024);
  if (parsedBody.tooLarge) return Response.json({ error: "Request body is too large" }, { status: 413 });
  if (!parsedBody.valid || !parsedBody.value || typeof parsedBody.value !== "object" || Array.isArray(parsedBody.value)) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = parsedBody.value as Record<string, unknown>;

  const event = body.event;
  if (
    typeof event !== "string" ||
    event.trim().length === 0 ||
    event.trim().length > 80 ||
    !isAllowedClientCommerceEvent(event.trim())
  ) {
    return Response.json({ error: "Invalid or disallowed event" }, { status: 400 });
  }

  const { event: _e, ...rest } = body;
  const safeProperties = sanitizeCommerceObservabilityPayload(rest);
  const distinctId = session.user.email?.trim().toLowerCase() ?? getRequestIp(req);
  logCommerceObservabilityServer(event.trim() as CommerceObservabilityEvent, {
    ...safeProperties,
  });
  void capturePostHogEvent({
    event: `commerce_${event.trim()}`,
    distinctId,
    properties: {
      ...safeProperties,
      source: "commerce_telemetry_route",
    },
  });

  return Response.json({ ok: true });
}
