import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffOrganization = {
  id: string;
  role: "owner" | "admin" | "manager" | "staff";
};

/** Resolves tenant scope from the server-side membership ledger, never from request input. */
export async function resolveStaffOrganization(
  client: SupabaseClient,
  email: string | null | undefined,
): Promise<StaffOrganization | null> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  // Membership authorization is keyed by the immutable platform user id. Email
  // remains the lookup input only so existing route callers do not trust client data.
  const { data: user, error: userError } = await client
    .from("users")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();
  if (userError || !user?.id) {
    if (process.env.AUTH_DISABLED !== "true" || normalized !== "local-admin@example.com") return null;
    const { data: localRows, error: localError } = await client
      .from("organization_memberships")
      .select("organization_id,role")
      .eq("user_email", normalized)
      .eq("active", true)
      .limit(2);
    if (localError || !localRows || localRows.length !== 1) return null;
    const local = localRows[0] as { organization_id?: unknown; role?: unknown };
    if (typeof local.organization_id !== "string" || !["owner", "admin", "manager", "staff"].includes(String(local.role))) return null;
    return { id: local.organization_id, role: local.role as StaffOrganization["role"] };
  }

  const { data, error } = await client
    .from("organization_memberships")
    .select("organization_id,role,auth_user_id")
    .eq("auth_user_id", String(user.id))
    .eq("active", true)
    .limit(2);
  if (error || !data || data.length !== 1) return null;
  const row = data[0] as {
    organization_id?: unknown;
    role?: unknown;
    auth_user_id?: unknown;
  };
  if (String(row.auth_user_id) !== String(user.id)) return null;
  if (typeof row.organization_id !== "string") return null;
  if (!["owner", "admin", "manager", "staff"].includes(String(row.role)))
    return null;
  return {
    id: row.organization_id,
    role: row.role as StaffOrganization["role"],
  };
}

export function organizationCanManagePayments(
  role: StaffOrganization["role"],
): boolean {
  return role === "owner";
}

export function organizationCanManageCrmConnections(
  role: StaffOrganization["role"],
): boolean {
  return role === "owner";
}
