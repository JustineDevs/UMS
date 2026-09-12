type IsolatedCodAttempt = {
  cart_id: string;
  correlation_id: string;
  provider: "cod";
  status: "initiated" | "completed";
  quote_fingerprint: string;
  finalize_attempts: number;
  claimed: boolean;
  medusa_order_id?: string;
};

const ISOLATED_COD_LEDGER_KEY = Symbol.for("uvs.isolated-cod-e2e-ledger");
type IsolatedCodLedgerGlobal = typeof globalThis & {
  [ISOLATED_COD_LEDGER_KEY]?: Map<string, IsolatedCodAttempt>;
};

// Next dev compiles route handlers into separate bundles. Keep the local-only
// E2E ledger on globalThis so registration and placement observe one state store
// across those bundles, while production continues to use the durable ledger.
const attempts =
  ((globalThis as IsolatedCodLedgerGlobal)[ISOLATED_COD_LEDGER_KEY] ??=
    new Map<string, IsolatedCodAttempt>());

export function isIsolatedCodE2E(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.CI_STRICT_E2E === "1" &&
    (process.env.AUTH_DISABLED === "true" ||
      process.env.AUTH_DISABLE === "true" ||
      process.env.NEXT_PUBLIC_AUTH_DISABLED === "true" ||
      process.env.NEXT_PUBLIC_AUTH_DISABLE === "true")
  );
}

export function registerIsolatedCodAttempt(input: {
  cartId: string;
  quoteFingerprint: string;
}): { correlationId: string; reused: boolean } {
  const existing = [...attempts.values()].find(
    (attempt) =>
      attempt.cart_id === input.cartId &&
      attempt.status === "initiated" &&
      attempt.quote_fingerprint === input.quoteFingerprint,
  );
  if (existing) {
    return { correlationId: existing.correlation_id, reused: true };
  }

  const correlationId = `e2e_cod_${crypto.randomUUID()}`;
  attempts.set(correlationId, {
    cart_id: input.cartId,
    correlation_id: correlationId,
    provider: "cod",
    status: "initiated",
    quote_fingerprint: input.quoteFingerprint,
    finalize_attempts: 0,
    claimed: false,
  });
  return { correlationId, reused: false };
}

export function getIsolatedCodAttempt(correlationId: string): IsolatedCodAttempt | null {
  return attempts.get(correlationId) ?? null;
}

export function incrementIsolatedCodFinalizeAttempts(correlationId: string): void {
  const attempt = attempts.get(correlationId);
  if (attempt) attempt.finalize_attempts += 1;
}

export function claimIsolatedCodAttempt(correlationId: string): boolean {
  const attempt = attempts.get(correlationId);
  if (!attempt || attempt.claimed || attempt.status === "completed") return false;
  attempt.claimed = true;
  return true;
}

export function updateIsolatedCodAttempt(
  correlationId: string,
  patch: Record<string, unknown>,
): void {
  const attempt = attempts.get(correlationId);
  if (!attempt) return;
  if (patch.status === "completed") attempt.status = "completed";
  if (typeof patch.medusa_order_id === "string") {
    attempt.medusa_order_id = patch.medusa_order_id;
  }
}
