import type { SupabaseClient } from "@supabase/supabase-js";

export const PUBLIC_DELIVERY_KINDS = [
  "newsletter_confirmation",
  "public_form_webhook",
  "public_form_email",
  "back_in_stock",
] as const;

export type PublicDeliveryKind = (typeof PUBLIC_DELIVERY_KINDS)[number];
export type PublicDeliveryStatus =
  | "queued" | "sent" | "bounced" | "failed" | "suppressed" | "retry" | "unsubscribe";

const transitions: Record<PublicDeliveryStatus, readonly PublicDeliveryStatus[]> = {
  queued: ["sent", "bounced", "failed", "suppressed", "retry", "unsubscribe"],
  retry: ["sent", "bounced", "failed", "suppressed", "retry", "unsubscribe"],
  sent: ["bounced", "unsubscribe"],
  bounced: ["retry", "suppressed", "unsubscribe"],
  failed: ["retry", "suppressed", "unsubscribe"],
  suppressed: [],
  unsubscribe: [],
};

export function canTransitionPublicDelivery(current: PublicDeliveryStatus, next: PublicDeliveryStatus): boolean {
  return current === next || transitions[current].includes(next);
}

export function publicDeliveryIdempotencyKey(
  kind: PublicDeliveryKind,
  aggregateId: string,
): string {
  return `${kind}:${aggregateId}`;
}

export async function recordPublicDeliveryAttempt(
  supabase: SupabaseClient,
  input: {
    kind: PublicDeliveryKind;
    aggregateId: string;
    recipient?: string | null;
    provider: string;
    idempotencyKey?: string;
  },
): Promise<boolean> {
  const { error } = await supabase.from("public_delivery_attempts").upsert(
    {
      delivery_kind: input.kind,
      aggregate_id: input.aggregateId,
      recipient: input.recipient ?? null,
      provider: input.provider,
      status: "queued",
      idempotency_key:
        input.idempotencyKey ?? publicDeliveryIdempotencyKey(input.kind, input.aggregateId),
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );
  return !error;
}

export async function finishPublicDeliveryAttempt(
  supabase: SupabaseClient,
  idempotencyKey: string,
  result: {
    status: Exclude<PublicDeliveryStatus, "queued" | "retry">;
    providerMessageId?: string | null;
    error?: string | null;
    sentAt?: string | null;
  },
): Promise<boolean> {
  const { error } = await supabase
    .from("public_delivery_attempts")
    .update({
      status: result.status,
      provider_message_id: result.providerMessageId ?? null,
      last_error: result.error ?? null,
      sent_at: result.sentAt ?? (result.status === "sent" ? new Date().toISOString() : null),
    })
    .eq("idempotency_key", idempotencyKey);
  return !error;
}

export async function updatePublicDeliveryStatus(
  supabase: SupabaseClient,
  idempotencyKey: string,
  result: { from: PublicDeliveryStatus; status: PublicDeliveryStatus; error?: string | null; suppressionReason?: string | null; nextAttemptAt?: string | null },
): Promise<boolean> {
  if (!canTransitionPublicDelivery(result.from, result.status)) return false;
  const { error } = await supabase.from("public_delivery_attempts").update({
    status: result.status,
    last_error: result.error ?? null,
    suppression_reason: result.suppressionReason ?? null,
    next_attempt_at: result.nextAttemptAt ?? null,
    last_attempt_at: new Date().toISOString(),
  }).eq("idempotency_key", idempotencyKey);
  return !error;
}

export async function isEmailUnsubscribed(
  supabase: SupabaseClient,
  email: string,
  organizationId: string | null = null,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("marketing_preferences")
      .select("consent_status").eq("organization_id", organizationId)
      .eq("email", email.trim().toLowerCase()).eq("channel", "email").maybeSingle();
    return !error && data?.consent_status === "unsubscribed";
  } catch {
    // A consent lookup failure must not turn into an unsolicited send.
    return true;
  }
}
