import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Minimal device row used by terminal-agent (matches pos_devices.config usage). */
export type AgentPosDevice = {
  config: Record<string, unknown>;
};

function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anon = process.env.SUPABASE_ANON_KEY?.trim();
  const key = service ?? anon;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function fetchDeviceByName(
  name: string,
): Promise<AgentPosDevice | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("pos_devices")
    .select("config")
    .eq("name", name.trim())
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { config?: unknown };
  return {
    config:
      row.config && typeof row.config === "object" && !Array.isArray(row.config)
        ? (row.config as Record<string, unknown>)
        : {},
  };
}

export async function heartbeatDeviceByName(name: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb
    .from("pos_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("name", name.trim());
}
