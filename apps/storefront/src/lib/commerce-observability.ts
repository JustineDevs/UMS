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
  | "admin_catalog_mutation_classified"
  | "storefront_revalidation_triggered"
  | "checkout_tab_lease_conflict";

export function logCommerceObservabilityServer(
  event: CommerceObservabilityEvent,
  payload: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    source: "storefront_server",
    event,
    ...payload,
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
