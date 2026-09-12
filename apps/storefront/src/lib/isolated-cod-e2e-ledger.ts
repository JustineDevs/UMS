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

const attempts = new Map<string, IsolatedCodAttempt>();

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
