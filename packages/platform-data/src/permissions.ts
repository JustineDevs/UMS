import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export const STAFF_PERMISSION_KEYS = [
  "dashboard:read",
  "inventory:read",
  "inventory:write",
  "catalog:read",
  "catalog:write",
  "orders:read",
  "orders:write",
  "pos:use",
  "pos:void",
  "pos:discount_override",
  "pos:refund",
  "pos:shift_manage",
  "analytics:read",
  "analytics:export",
  "crm:read",
  "crm:write",
  "crm:segments",
  "channels:manage",
  "integrations:manage",
  "chat_orders:manage",
  "settings:read",
  "settings:write",
  "content:read",
  "content:write",
  "content:publish",
  "employees:read",
  "employees:write",
  "loyalty:read",
  "loyalty:write",
  "campaigns:read",
  "campaigns:write",
  "campaigns:execute",
  "devices:manage",
  "receipts:read",
  "receipts:send",
] as const;

export type StaffPermissionKey = (typeof STAFF_PERMISSION_KEYS)[number];

/**
 * Legacy flag. RBAC is now role-aware: `admin` users receive wildcard `*` from
 * `resolveStaffPermissionsForUserId`; `staff` users only receive explicit `staff_permission_grants`.
 * Kept for callers that still read this env (e.g. ops scripts).
 */
export function isStaffRbacStrictEnv(): boolean {
  if (typeof process === "undefined" || !process.env) return false;
  return (
    process.env.NEXT_PUBLIC_STAFF_RBAC_STRICT === "true" ||
    process.env.STAFF_RBAC_STRICT === "true"
  );
}

/** Minimal session shape for RBAC (NextAuth session, RSC props, etc.). */
export type StaffSessionLike = {
  user?: { permissions?: string[]; role?: string };
} | null | undefined;

/**
 * Effective permission keys for checks in API routes and client components.
 * When Supabase-backed `permissions` is temporarily empty but `role` is `admin`
 * (e.g. session hydration), treat as full access (`*`).
 */
export function staffPermissionListForSession(session: StaffSessionLike): string[] {
  const p = session?.user?.permissions ?? [];
  if (p.length > 0) {
    return [...p];
  }
  if (session?.user?.role === "admin") {
    return ["*"];
  }
  return [];
}

/**
 * Returns whether the staff session allows `key`.
 * - `null`, `undefined`, or empty list: deny (no implicit superuser).
 * - `*` in the list: allow any key (used for admin role resolution).
 */
export function staffHasPermission(
  permissions: readonly string[] | undefined | null,
  key: string,
): boolean {
  if (permissions == null || permissions.length === 0) {
    return false;
  }
  if (permissions.includes("*")) {
    return true;
  }
  return permissions.includes(key);
}

/**
 * Permission check for API routes and RSC: uses {@link staffPermissionListForSession}
 * so admin role resolves to `*` when the JWT snapshot is empty.
 * Prefer this over `staffHasPermission(session.user.permissions ?? [], key)`.
 */
export function staffSessionAllows(
  session: StaffSessionLike,
  key: string,
): boolean {
  return staffHasPermission(staffPermissionListForSession(session), key);
}

/**
 * Resolves effective permission keys for the Supabase user.
 * - **admin** → `["*"]` (full back office; no grant rows required).
 * - **staff** → keys from `staff_permission_grants` only; empty means no screens/APIs.
 * - **customer** (or unknown) → `[]` (should not reach admin session).
 */
export async function resolveStaffPermissionsForUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data: roleRow, error: roleErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (roleErr) {
    console.error("[platform-data] resolveStaffPermissionsForUserId user_roles", roleErr);
    return [];
  }

  const role = (roleRow?.role as string) ?? "customer";
  if (role === "admin") {
    return ["*"];
  }
  if (role !== "staff") {
    return [];
  }

  const { data, error } = await supabase
    .from("staff_permission_grants")
    .select("permission_key")
    .eq("user_id", userId);

  if (error) {
    const msg = error.message ?? "";
    if (
      isMissingTableOrSchemaError(error) ||
      msg.includes("does not exist") ||
      msg.includes("staff_permission_grants")
    ) {
      console.warn(
        "[platform-data] staff_permission_grants unavailable; staff user has no permissions until the table exists and is seeded",
      );
      return [];
    }
    console.error("[platform-data] resolveStaffPermissionsForUserId", error);
    return [];
  }

  if (!data?.length) {
    return [];
  }

  return data.map((r) => String((r as { permission_key: string }).permission_key));
}
