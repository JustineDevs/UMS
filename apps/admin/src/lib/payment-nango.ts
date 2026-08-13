export type PaymentNangoIntegration = {
  id: string;
  label: string;
};

export type PaymentNangoConnection = {
  provider_config_key: string;
  nango_connection_id: string;
  provider: string | null;
  active: boolean;
  status: "connected" | "needs_attention";
  error: string | null;
  updated_at: string;
};

export function configuredPaymentIntegrations(): PaymentNangoIntegration[] {
  return (process.env.NANGO_PAYMENT_INTEGRATIONS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((id) => ({ id, label: paymentIntegrationLabel(id) }));
}

export function paymentIntegrationLabel(id: string): string {
  const normalized = id.toLowerCase();
  if (normalized.includes("paypal")) return normalized.includes("sandbox") ? "PayPal Sandbox" : "PayPal";
  if (normalized.includes("stripe")) return normalized.includes("sandbox") ? "Stripe Sandbox" : "Stripe";
  if (normalized.includes("xendit")) return normalized.includes("sandbox") ? "Xendit Test" : "Xendit";
  return id.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function nangoErrorMessage(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const first = value[0] as Record<string, unknown> | null;
  if (!first || typeof first !== "object") return "Nango reported an authorization error";
  const message = first.message ?? first.type ?? first.error;
  return typeof message === "string" ? message : "Nango reported an authorization error";
}
