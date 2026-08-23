import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isMissingTableOrSchemaError } from "./supabase-errors.js";
import { assertPaymentCheckoutTransition } from "./payment-state-machine.js";

export type PaymentAttemptRow = {
  id: string;
  organization_id: string | null;
  correlation_id: string;
  cart_id: string;
  order_id: string | null;
  provider: string;
  provider_session_id: string | null;
  provider_payment_id: string | null;
  status: string;
  checkout_state: string;
  amount_minor: number | null;
  currency: string | null;
  medusa_payment_session_id: string | null;
  medusa_payment_id: string | null;
  medusa_order_id: string | null;
  last_error: string | null;
  idempotency_key: string | null;
  webhook_last_event_id: string | null;
  webhook_last_status: string | null;
  finalize_attempts: number;
  quote_fingerprint: string | null;
  /** Increments when quote fingerprint changes on this row (PRD). */
  quote_version: number | null;
  stale_reason: string | null;
  invalidated_at: string | null;
  invalidated_by: string | null;
  provider_payload?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
};

const OPEN_STATUSES = new Set([
  "initiated",
  "pending_payment",
  "pending_capture",
  "paid",
  "authorized",
  "pending_provider_redirect",
  "paid_awaiting_order",
  "finalizing_order",
  "awaiting_completion",
  "needs_review",
]);

function isOpenStatus(status: string): boolean {
  return OPEN_STATUSES.has(status);
}

export async function findOpenPaymentAttemptForCart(
  supabase: SupabaseClient,
  cartId: string,
  provider: string,
): Promise<PaymentAttemptRow | null> {
  const { data, error } = await supabase
    .from("payment_attempts")
    .select("*")
    .eq("cart_id", cartId)
    .eq("provider", provider)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    throw error;
  }
  const rows = (data ?? []) as PaymentAttemptRow[];
  return rows.find((r) => isOpenStatus(r.status)) ?? null;
}

export type RegisterPaymentAttemptInput = {
  organizationId?: string;
  cartId: string;
  provider: string;
  amountMinor: number;
  currencyCode: string;
  quoteFingerprint?: string;
  variantIds?: string[];
  productIds?: string[];
  medusaPaymentSessionId?: string;
  providerSessionId?: string;
  providerPaymentId?: string;
  idempotencyKey?: string;
};

function normalizeQuoteFingerprint(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

/**
 * When patching `quote_fingerprint` on an existing row, bump `quote_version` if the
 * normalized fingerprint value changes. Returns undefined when unchanged or when the
 * caller should not auto-bump (same fingerprint).
 */
export function computeNextQuoteVersionForFingerprintPatch(
  currentFingerprint: string | null | undefined,
  nextFingerprint: string | null | undefined,
  currentVersion: number | null | undefined,
): number | undefined {
  const oldFp = normalizeQuoteFingerprint(currentFingerprint);
  const newFp = normalizeQuoteFingerprint(nextFingerprint);
  if (oldFp === newFp) return undefined;
  return (currentVersion ?? 1) + 1;
}

/** Daily counts of rows with `invalidated_at` set (stale-session / catalog invalidation). */
export async function fetchPaymentAttemptInvalidationDayBuckets(
  supabase: SupabaseClient,
  days: number,
): Promise<{ day: string; count: number }[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - Math.max(1, Math.min(90, days)));
  const { data, error } = await supabase
    .from("payment_attempts")
    .select("invalidated_at")
    .not("invalidated_at", "is", null)
    .gte("invalidated_at", since.toISOString());
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    throw error;
  }
  const buckets = new Map<string, number>();
  for (const row of data ?? []) {
    const raw = (row as { invalidated_at?: string | null }).invalidated_at;
    const d = typeof raw === "string" ? raw.slice(0, 10) : "";
    if (!d) continue;
    buckets.set(d, (buckets.get(d) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));
}

function sortedDistinctStrings(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].sort();
}

function buildQuoteProviderPayload(input: RegisterPaymentAttemptInput): Record<string, unknown> {
  return {
    quote: {
      fingerprint: normalizeQuoteFingerprint(input.quoteFingerprint) || null,
      variant_ids: sortedDistinctStrings(input.variantIds),
      product_ids: sortedDistinctStrings(input.productIds),
    },
  };
}

export function shouldReusePaymentAttempt(
  existing: Pick<PaymentAttemptRow, "quote_fingerprint"> | null,
  input: Pick<RegisterPaymentAttemptInput, "quoteFingerprint">,
): boolean {
  if (!existing) return false;
  const existingFingerprint = normalizeQuoteFingerprint(existing.quote_fingerprint);
  const nextFingerprint = normalizeQuoteFingerprint(input.quoteFingerprint);
  return existingFingerprint.length > 0 && existingFingerprint === nextFingerprint;
}

export function paymentAttemptMatchesCatalogMutation(
  row: Pick<PaymentAttemptRow, "provider_payload">,
  input: { variantIds?: string[]; productIds?: string[] },
): boolean {
  const payload =
    row.provider_payload && typeof row.provider_payload === "object"
      ? (row.provider_payload as Record<string, unknown>)
      : {};
  const quote =
    payload.quote && typeof payload.quote === "object"
      ? (payload.quote as Record<string, unknown>)
      : {};
  const rowVariantIds = new Set(
    Array.isArray(quote.variant_ids)
      ? quote.variant_ids
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          .map((value) => value.trim())
      : [],
  );
  const rowProductIds = new Set(
    Array.isArray(quote.product_ids)
      ? quote.product_ids
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          .map((value) => value.trim())
      : [],
  );

  const variantMatch = (input.variantIds ?? []).some((variantId) => rowVariantIds.has(variantId.trim()));
  const productMatch = (input.productIds ?? []).some((productId) => rowProductIds.has(productId.trim()));
  return variantMatch || productMatch;
}

export async function registerPaymentAttempt(
  supabase: SupabaseClient,
  input: RegisterPaymentAttemptInput,
): Promise<{ correlationId: string; reused: boolean }> {
  const existing = await findOpenPaymentAttemptForCart(
    supabase,
    input.cartId,
    input.provider,
  );
  if (existing) {
    const nextQuotePayload = buildQuoteProviderPayload(input);
      if (shouldReusePaymentAttempt(existing, input)) {
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        amount_minor: input.amountMinor,
        currency: input.currencyCode.toLowerCase(),
        quote_fingerprint: normalizeQuoteFingerprint(input.quoteFingerprint) || null,
        quote_version: existing.quote_version ?? 1,
        stale_reason: null,
        invalidated_at: null,
        invalidated_by: null,
        provider_payload: {
          ...(existing.provider_payload && typeof existing.provider_payload === "object"
            ? existing.provider_payload
            : {}),
          ...nextQuotePayload,
        },
      };
      if (input.organizationId?.trim()) patch.organization_id = input.organizationId.trim();
      if (input.medusaPaymentSessionId) {
        patch.medusa_payment_session_id = input.medusaPaymentSessionId;
      }
      if (input.providerSessionId) {
        patch.provider_session_id = input.providerSessionId;
      }
      if (input.providerPaymentId) {
        patch.provider_payment_id = input.providerPaymentId;
      }
      if (input.idempotencyKey) {
        patch.idempotency_key = input.idempotencyKey;
      }
      const { error } = await supabase
        .from("payment_attempts")
        .update(patch)
        .eq("id", existing.id);
      if (error) throw error;
      return { correlationId: existing.correlation_id, reused: true };
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      status: "expired",
      checkout_state: "needs_review",
      stale_reason: "quote_changed",
      invalidated_at: new Date().toISOString(),
      invalidated_by: "quote_fingerprint",
      last_error: "Your checkout total changed. Review the updated order before paying.",
    };
    if (input.organizationId?.trim()) patch.organization_id = input.organizationId.trim();
    const { error } = await supabase
      .from("payment_attempts")
      .update(patch)
      .eq("id", existing.id);
    if (error) throw error;
  }

  const correlationId = randomUUID();
  const quotePayload = buildQuoteProviderPayload(input);
  const { error } = await supabase.from("payment_attempts").insert({
    ...(input.organizationId?.trim() ? { organization_id: input.organizationId.trim() } : {}),
    correlation_id: correlationId,
    cart_id: input.cartId,
    provider: input.provider,
    status: "initiated",
    checkout_state: "awaiting_provider",
    amount_minor: input.amountMinor,
    currency: input.currencyCode.toLowerCase(),
    quote_fingerprint: normalizeQuoteFingerprint(input.quoteFingerprint) || null,
    quote_version: 1,
    medusa_payment_session_id: input.medusaPaymentSessionId ?? null,
    provider_session_id: input.providerSessionId ?? null,
    provider_payment_id: input.providerPaymentId ?? null,
    idempotency_key: input.idempotencyKey ?? null,
    provider_payload: quotePayload,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { correlationId, reused: false };
}

export async function findPaymentAttemptByMedusaOrderId(
  supabase: SupabaseClient,
  medusaOrderId: string,
): Promise<PaymentAttemptRow | null> {
  const { data, error } = await supabase
    .from("payment_attempts")
    .select("*")
    .eq("medusa_order_id", medusaOrderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    throw error;
  }
  return (data as PaymentAttemptRow) ?? null;
}

export async function getPaymentAttemptByCorrelationId(
  supabase: SupabaseClient,
  correlationId: string,
): Promise<PaymentAttemptRow | null> {
  const { data, error } = await supabase
    .from("payment_attempts")
    .select("*")
    .eq("correlation_id", correlationId)
    .maybeSingle();
  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    throw error;
  }
  return (data as PaymentAttemptRow) ?? null;
}

export async function updatePaymentAttemptByCorrelationId(
  supabase: SupabaseClient,
  correlationId: string,
  patch: Partial<
    Pick<
      PaymentAttemptRow,
      | "status"
      | "checkout_state"
      | "medusa_order_id"
      | "last_error"
      | "finalize_attempts"
      | "order_id"
      | "provider_payment_id"
      | "webhook_last_event_id"
      | "webhook_last_status"
      | "quote_fingerprint"
      | "quote_version"
      | "stale_reason"
      | "invalidated_at"
      | "invalidated_by"
      | "provider_payload"
    >
  > & { finalized_at?: string | null },
): Promise<void> {
  let merged: Record<string, unknown> = { ...patch };
  if (typeof patch.checkout_state === "string") {
    const current = await getPaymentAttemptByCorrelationId(supabase, correlationId);
    assertPaymentCheckoutTransition(current?.checkout_state, patch.checkout_state);
  }
  if (patch.quote_fingerprint !== undefined && patch.quote_version === undefined) {
    const row = await getPaymentAttemptByCorrelationId(supabase, correlationId);
    if (row) {
      const bump = computeNextQuoteVersionForFingerprintPatch(
        row.quote_fingerprint,
        patch.quote_fingerprint,
        row.quote_version,
      );
      if (bump !== undefined) {
        merged = { ...merged, quote_version: bump };
      }
    }
  }
  const { error } = await supabase
    .from("payment_attempts")
    .update({
      ...merged,
      updated_at: new Date().toISOString(),
    })
    .eq("correlation_id", correlationId);
  if (error) throw error;
}

export async function mergePaymentAttemptProviderPayload(
  supabase: SupabaseClient,
  correlationId: string,
  merge: Record<string, unknown>,
): Promise<void> {
  const row = await getPaymentAttemptByCorrelationId(supabase, correlationId);
  if (!row) return;
  const prev =
    row.provider_payload && typeof row.provider_payload === "object"
      ? (row.provider_payload as Record<string, unknown>)
      : {};
  await updatePaymentAttemptByCorrelationId(supabase, correlationId, {
    provider_payload: { ...prev, ...merge },
  });
}

export async function mergePaymentAttemptPayloadByMedusaOrderId(
  supabase: SupabaseClient,
  medusaOrderId: string,
  merge: Record<string, unknown>,
): Promise<void> {
  const row = await findPaymentAttemptByMedusaOrderId(supabase, medusaOrderId);
  if (!row) return;
  await mergePaymentAttemptProviderPayload(supabase, row.correlation_id, merge);
}

export async function incrementFinalizeAttempts(
  supabase: SupabaseClient,
  correlationId: string,
): Promise<void> {
  const row = await getPaymentAttemptByCorrelationId(supabase, correlationId);
  if (!row) return;
  await updatePaymentAttemptByCorrelationId(supabase, correlationId, {
    finalize_attempts: (row.finalize_attempts ?? 0) + 1,
    checkout_state: "finalizing_order",
    status: "finalizing_order",
  });
}

export async function listOpenPaymentAttempts(
  supabase: SupabaseClient,
  limit: number,
): Promise<PaymentAttemptRow[]> {
  const { data, error } = await supabase
    .from("payment_attempts")
    .select("*")
    .in("status", [...OPEN_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(Math.min(500, Math.max(1, limit)));
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []) as PaymentAttemptRow[];
}

export async function listStuckPaymentAttempts(
  supabase: SupabaseClient,
  limit: number,
): Promise<PaymentAttemptRow[]> {
  const { data, error } = await supabase
    .from("payment_attempts")
    .select("*")
    .in("status", ["paid_awaiting_order", "finalizing_order"])
    .is("medusa_order_id", null)
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []) as PaymentAttemptRow[];
}

/** Alias for reconciliation jobs and operator docs (stale = paid but no order id). */
export async function listStalePaymentAttempts(
  supabase: SupabaseClient,
  limit: number,
): Promise<PaymentAttemptRow[]> {
  return listStuckPaymentAttempts(supabase, limit);
}

export async function claimPaymentAttemptForFinalization(
  supabase: SupabaseClient,
  correlationId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("claim_payment_attempt_for_finalization", {
    p_correlation_id: correlationId,
  });
  if (error) throw error;
  return data === true;
}

export async function listRecentPaymentAttempts(
  supabase: SupabaseClient,
  limit: number,
  organizationId?: string,
): Promise<PaymentAttemptRow[]> {
  let query = supabase
    .from("payment_attempts")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(Math.min(500, Math.max(1, limit)));
  if (organizationId?.trim()) query = query.eq("organization_id", organizationId.trim());
  const { data, error } = await query;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []) as PaymentAttemptRow[];
}

export async function countPaymentAttemptsByStatuses(
  supabase: SupabaseClient,
  statuses: string[],
): Promise<number> {
  if (statuses.length === 0) return 0;
  const { count, error } = await supabase
    .from("payment_attempts")
    .select("*", { count: "exact", head: true })
    .in("status", statuses);
  if (error) {
    if (isMissingTableOrSchemaError(error)) return 0;
    throw error;
  }
  return count ?? 0;
}
