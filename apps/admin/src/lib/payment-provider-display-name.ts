/**
 * Turns Medusa internal payment provider IDs (e.g. pp_stripe-ideal_stripe) into
 * labels non-technical staff recognize. Unknown IDs get a best-effort title.
 */

const EXACT: Record<string, string> = {
  pp_system_default: "System default",
  pp_cod_cod: "Cash on delivery (COD)",
  pp_paypal_paypal: "PayPal",
  pp_stripe_stripe: "Stripe",
};

const STRIPE_SUFFIX = /^pp_stripe-(.+)_stripe$/;

/** Lowercase method slug from pp_stripe-<method>_stripe → display fragment */
const STRIPE_METHOD_LABEL: Record<string, string> = {
  ideal: "iDEAL",
  bancontact: "Bancontact",
  blik: "BLIK",
  promptpay: "PromptPay",
  przelewy24: "Przelewy24",
  giropay: "Giropay",
  oxxo: "OXXO",
};

function titleCaseWords(s: string): string {
  return s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function brandFromRepeatedPattern(id: string): string | null {
  // pp_paypal_paypal → paypal
  if (!id.startsWith("pp_")) return null;
  const inner = id.slice(3);
  const idx = inner.indexOf("_");
  if (idx === -1) return null;
  const first = inner.slice(0, idx);
  const rest = inner.slice(idx + 1);
  if (first === rest) {
    const known = EXACT[`pp_${first}_${first}`];
    if (known) return known;
    if (first.toLowerCase() === "cod") return "Cash on delivery (COD)";
    if (first.toLowerCase() === "paypal") return "PayPal";
    if (first.toLowerCase() === "stripe") return "Stripe";
    return titleCaseWords(first);
  }
  return null;
}

/**
 * Human-readable label for a payment provider id from the Medusa API.
 */
export function getPaymentProviderDisplayName(id: string): string {
  const exact = EXACT[id];
  if (exact) return exact;

  const stripeMethod = id.match(STRIPE_SUFFIX);
  if (stripeMethod) {
    const raw = stripeMethod[1].toLowerCase();
    const fragment =
      STRIPE_METHOD_LABEL[raw] ?? titleCaseWords(stripeMethod[1]);
    return `Stripe (${fragment})`;
  }

  const repeated = brandFromRepeatedPattern(id);
  if (repeated) return repeated;

  if (id.startsWith("pp_")) {
    const tail = id.slice(3).replace(/_/g, " ");
    return titleCaseWords(tail);
  }

  return id;
}
