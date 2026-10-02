import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

function trackingCapabilityHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function isTrackingCapabilityRevoked(
  client: SupabaseClient,
  token: string,
): Promise<boolean | null> {
  const { data, error } = await client
    .from("tracking_capability_revocations")
    .select("id")
    .eq("capability_hash", trackingCapabilityHash(token))
    .maybeSingle();
  if (error) {
    // Local auth-disabled runs may precede migration 108; never weaken production.
    if (process.env.NODE_ENV !== "production" && process.env.AUTH_DISABLE === "true" && isMissingTableOrSchemaError(error)) {
      return false;
    }
    return null;
  }
  return data != null;
}
