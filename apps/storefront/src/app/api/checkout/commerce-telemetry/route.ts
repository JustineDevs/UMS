import { getStorefrontSession } from "@/lib/auth";
import {
  logCommerceObservabilityServer,
  type CommerceObservabilityEvent,
} from "@/lib/commerce-observability";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { capturePostHogEvent } from "@universal-music-store/sdk";

export const dynamic = "force-dynamic";

const ALLOWED = new Set<CommerceObservabilityEvent>([
  "checkout_quote_generated",
  "checkout_quote_changed",
  "payment_session_created",
  "payment_session_invalidated",
  "payment_session_completed",
  "payment_session_recovered",
  "checkout_provider_action_resolved",
  "checkout_tab_lease_conflict",
]);

/**
 * Client-emitted commerce observability (authenticated shoppers only).
 */
export async function POST(req: Request) {
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

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.event;
  if (
    typeof event !== "string" ||
    event.trim().length === 0 ||
    event.trim().length > 80 ||
    !ALLOWED.has(event as CommerceObservabilityEvent)
  ) {
    return Response.json({ error: "Invalid or disallowed event" }, { status: 400 });
  }

  const { event: _e, ...rest } = body;
  const distinctId = session.user.email?.trim().toLowerCase() ?? getRequestIp(req);
  logCommerceObservabilityServer(event.trim() as CommerceObservabilityEvent, {
    ...rest,
    actorEmail: session.user.email?.trim().toLowerCase(),
  });
  void capturePostHogEvent({
    event: `commerce_${event.trim()}`,
    distinctId,
    properties: {
      ...rest,
      actorEmail: session.user.email?.trim().toLowerCase(),
      source: "commerce_telemetry_route",
    },
  });

  return Response.json({ ok: true });
}
