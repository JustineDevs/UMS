import type { SupabaseClient } from "@supabase/supabase-js";

import { PAYMENT_OUTBOX_EVENT_TYPES } from "./payment-outbox-events.js";

export type OutboxEvent = {
  id?: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at?: string;
  processed_at?: string | null;
  retry_count?: number;
  last_error?: string | null;
  next_retry_at?: string | null;
  retry_reason?: string | null;
};

const MAX_OUTBOX_ATTEMPTS = 12;

export async function enqueueOutboxEvent(
  supabase: SupabaseClient,
  event: Omit<OutboxEvent, "id" | "created_at" | "processed_at" | "retry_count">,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("outbox_events")
    .insert({
      aggregate_type: event.aggregate_type,
      aggregate_id: event.aggregate_id,
      event_type: event.event_type,
      payload: event.payload,
      retry_count: 0,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[outbox] enqueue failed:", error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function listPendingOutboxEvents(
  supabase: SupabaseClient,
  limit = 50,
): Promise<OutboxEvent[]> {
  const { data, error } = await supabase
    .from("outbox_events")
    .select("*")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(Math.min(200, limit * 4));

  if (error) {
    console.error("[outbox] list pending failed:", error.message);
    return [];
  }
  const now = Date.now();
  const rows = (data ?? []) as OutboxEvent[];
  return rows
    .filter((e) => {
      const rc = e.retry_count ?? 0;
      if (rc >= MAX_OUTBOX_ATTEMPTS) return false;
      if (!e.next_retry_at) return true;
      return new Date(e.next_retry_at).getTime() <= now;
    })
    .slice(0, limit);
}

export async function markOutboxEventProcessed(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("outbox_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", eventId);

  if (error) {
    console.error("[outbox] mark processed failed:", error.message);
    return false;
  }
  return true;
}

export async function incrementOutboxRetry(
  supabase: SupabaseClient,
  eventId: string,
): Promise<void> {
  await supabase.rpc("increment_outbox_retry", { event_id: eventId });
}

export async function failOutboxEventWithBackoff(
  supabase: SupabaseClient,
  eventId: string,
  err: unknown,
  retryReason: string,
): Promise<void> {
  const { data: row, error: readErr } = await supabase
    .from("outbox_events")
    .select("retry_count")
    .eq("id", eventId)
    .maybeSingle();
  if (readErr) {
    await incrementOutboxRetry(supabase, eventId);
    return;
  }
  const rc = ((row as { retry_count?: number } | null)?.retry_count ?? 0) + 1;
  const delayMs = Math.min(3_600_000, 1_000 * Math.pow(2, Math.min(rc, 16)));
  const msg = err instanceof Error ? err.message : String(err);
  await supabase
    .from("outbox_events")
    .update({
      retry_count: rc,
      last_error: msg.slice(0, 2000),
      retry_reason: retryReason.slice(0, 500),
      next_retry_at: new Date(Date.now() + delayMs).toISOString(),
    })
    .eq("id", eventId);
}

export type OutboxHandler = (event: OutboxEvent) => Promise<void>;

const handlers = new Map<string, OutboxHandler[]>();

export function registerOutboxHandler(eventType: string, handler: OutboxHandler): void {
  const existing = handlers.get(eventType) ?? [];
  existing.push(handler);
  handlers.set(eventType, existing);
}

let paymentOutboxHandlersRegistered = false;

function ensureDefaultPaymentOutboxHandlers(): void {
  if (paymentOutboxHandlersRegistered) return;
  paymentOutboxHandlersRegistered = true;
  for (const eventType of Object.values(PAYMENT_OUTBOX_EVENT_TYPES)) {
    const existing = handlers.get(eventType) ?? [];
    if (existing.length > 0) continue;
    registerOutboxHandler(eventType, async () => {
      /* durable record only; domain work runs in API routes */
    });
  }
}

export async function processOutboxBatch(
  supabase: SupabaseClient,
  limit = 50,
): Promise<{ processed: number; failed: number }> {
  ensureDefaultPaymentOutboxHandlers();
  const events = await listPendingOutboxEvents(supabase, limit);
  let processed = 0;
  let failed = 0;

  for (const event of events) {
    const eventHandlers = handlers.get(event.event_type) ?? [];
    if (eventHandlers.length === 0) {
      await markOutboxEventProcessed(supabase, event.id!);
      processed++;
      continue;
    }

    try {
      for (const handler of eventHandlers) {
        await handler(event);
      }
      await markOutboxEventProcessed(supabase, event.id!);
      processed++;
    } catch (err) {
      console.error(`[outbox] handler failed for ${event.event_type}:`, err);
      await failOutboxEventWithBackoff(
        supabase,
        event.id!,
        err,
        "handler_exception",
      );
      failed++;
    }
  }

  return { processed, failed };
}
