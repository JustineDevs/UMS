import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readResponseJson } from "./read-response-json";

export type ChannelEventRow = {
  id: string;
  channel: string;
  event_type: string;
  received_at: string;
  processed_at: string | null;
};

function parseChannelEvents(value: unknown): ChannelEventRow[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { events?: unknown }).events)) return [];
  return (value as { events: unknown[] }).events.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.channel !== "string" || typeof row.event_type !== "string" || typeof row.received_at !== "string") return [];
    return [{
      id: row.id,
      channel: row.channel,
      event_type: row.event_type,
      received_at: row.received_at,
      processed_at: typeof row.processed_at === "string" ? row.processed_at : null,
    }];
  });
}

export async function fetchRecentChannelEvents(limit = 50): Promise<ChannelEventRow[]> {
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!base) return [];
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getSession();
    const token = data.session?.access_token?.trim();
    if (error || !token) return [];
    const boundedLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 100) : 50;
    const response = await fetch(`${base}/api/admin/channels/events?limit=${boundedLimit}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return [];
    return parseChannelEvents(await readResponseJson(response, {}));
  } catch {
    return [];
  }
}
