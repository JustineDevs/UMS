import type { SupabaseClient } from "@supabase/supabase-js";

export const PUBLIC_DELIVERY_KINDS = [
  "newsletter_confirmation",
  "public_form_webhook",
  "public_form_email",
  "back_in_stock",
] as const;

export type PublicDeliveryKind = (typeof PUBLIC_DELIVERY_KINDS)[number];
export type PublicDeliveryStatus = "pending" | "sent" | "failed";

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
    status: Exclude<PublicDeliveryStatus, "pending">;
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
