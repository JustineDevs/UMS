import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type TrackingCapabilityRevocationInput = {
  token: string;
  resourceId: string;
  expiresAt?: string | null;
  revokedBy?: string | null;
  reason?: string | null;
};

export function trackingCapabilityHash(token: string): string {
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

export async function revokeTrackingCapability(
  client: SupabaseClient,
  input: TrackingCapabilityRevocationInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^(order|cart)_[A-Za-z0-9_-]+$/.test(input.resourceId)) {
    return { ok: false, error: "Invalid tracking resource" };
  }
  const { error } = await client.from("tracking_capability_revocations").upsert(
    {
      capability_hash: trackingCapabilityHash(input.token),
      resource_id: input.resourceId,
      expires_at: input.expiresAt ?? null,
      revoked_by: input.revokedBy ?? null,
      reason: input.reason?.trim().slice(0, 240) || null,
    },
    { onConflict: "capability_hash" },
  );
  return error ? { ok: false, error: "Unable to revoke tracking capability" } : { ok: true };
}
