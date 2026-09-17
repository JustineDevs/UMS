/**
 * Structured commerce observability hooks (stdout / client telemetry).
 * Events align with .omx/plans/test-spec-universal-music-store-cross-app-commerce-architecture.md § Observability.
 */

export type CommerceObservabilityEvent =
  | "checkout_quote_generated"
  | "checkout_quote_changed"
  | "payment_session_created"
  | "payment_session_invalidated"
  | "payment_session_completed"
  | "payment_session_recovered"
  | "checkout_provider_action_resolved"
  | "catalog_scan_completed"
  | "admin_catalog_mutation_classified"
  | "storefront_revalidation_triggered"
  | "checkout_tab_lease_conflict";

const ALLOWED_CLIENT_EVENTS = new Set<CommerceObservabilityEvent>([
  "checkout_quote_generated",
  "checkout_quote_changed",
  "payment_session_created",
  "payment_session_invalidated",
  "payment_session_completed",
  "payment_session_recovered",
  "checkout_provider_action_resolved",
  "checkout_tab_lease_conflict",
]);

export function isAllowedClientCommerceEvent(value: unknown): value is CommerceObservabilityEvent {
  return typeof value === "string" && ALLOWED_CLIENT_EVENTS.has(value as CommerceObservabilityEvent);
}

const CLIENT_PROPERTY_KEYS = new Set([
  "provider_id",
  "region_id",
  "payment_session_id",
  "action_kind",
  "redirect_url_present",
  "embedded_intent_present",
  "stripe_client_secret_present",
  "paypal_order_id_present",
  "xendit_components_sdk_key_present",
  "correlation_id",
  "reason",
  "fromFingerprint",
  "toFingerprint",
]);

const PRIVATE_COMMERCE_ID_KEYS = new Set([
  "cartId",
  "cart_id",
  "cartIdSuffix",
  "orderId",
  "order_id",
]);

export function sanitizeCommerceObservabilityPayload(
  input: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!CLIENT_PROPERTY_KEYS.has(key)) continue;
    if (value === null || typeof value === "boolean") {
      output[key] = value;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      output[key] = value;
    } else if (typeof value === "string") {
      output[key] = value.trim().slice(0, 160);
    }
  }
  return output;
}

export function logCommerceObservabilityServer(
  event: CommerceObservabilityEvent,
  payload: Record<string, unknown>,
): void {
  const safePayload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (PRIVATE_COMMERCE_ID_KEYS.has(key)) {
      const prefix = key.startsWith("cart") ? "cart" : "order";
      safePayload[`${prefix}_present`] = Boolean(value);
      continue;
    }
    safePayload[key] = value;
  }
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    source: "storefront_server",
    event,
    ...safePayload,
  });
  console.log(line);
}

/** Fire-and-forget from browser (authenticated checkout routes). */
export function emitCommerceObservabilityClient(
  event: CommerceObservabilityEvent,
  payload: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  try {
    void fetch("/api/checkout/commerce-telemetry", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...payload }),
    });
  } catch {
    /* ignore */
  }
}
