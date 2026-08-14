import type { SupabaseClient } from "@supabase/supabase-js";

import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type PaymentWebhookEventRow = {
  id: string;
  provider: string;
  event_id: string;
  event_type: string | null;
  payload_hash: string | null;
  payload: Record<string, unknown>;
  received_at: string;
  processed_at: string | null;
  status: string;
  processing_error: string | null;
  correlation_id: string | null;
};

export async function recordWebhookEvent(
  supabase: SupabaseClient,
  input: {
    provider: string;
    eventId: string;
    eventType?: string;
    payload: Record<string, unknown>;
    correlationId?: string;
    payloadHash?: string;
  },
): Promise<{ inserted: boolean; id?: string }> {
  const { data, error } = await supabase
    .from("payment_webhook_events")
    .insert({
      provider: input.provider,
      event_id: input.eventId,
      event_type: input.eventType ?? null,
      payload: input.payload,
      correlation_id: input.correlationId ?? null,
      payload_hash: input.payloadHash ?? null,
      status: "received",
      received_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (isMissingTableOrSchemaError(error)) return { inserted: false };
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { inserted: false };
    }
    const code = (error as { code?: string }).code;
    if (code === "23505") return { inserted: false };
    throw error;
  }
  return { inserted: Boolean(data?.id), id: data?.id };
}

export async function markWebhookProcessed(
  supabase: SupabaseClient,
  id: string,
  ok: boolean,
  processingError?: string,
): Promise<void> {
  const { error } = await supabase
    .from("payment_webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      status: ok ? "processed" : "failed",
      processing_error: processingError ?? null,
    })
    .eq("id", id);
  if (error && !isMissingTableOrSchemaError(error)) throw error;
}
