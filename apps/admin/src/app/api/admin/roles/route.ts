import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "employees:read")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;

  const [{ data: users, error: usersError }, { data: roleRows, error: rolesError }, { data: grants }] = await Promise.all([
    sup.client.from("users").select("id,created_at"),
    sup.client.from("user_roles").select("user_id,role"),
    sup.client.from("staff_permission_grants").select("user_id,permission_key"),
  ]);
  if (usersError || rolesError) return correlatedJson(cid, { error: "Unable to load roles" }, { status: 502 });

  const createdAt = new Map((users ?? []).map((user) => [String(user.id), user.created_at as string | null]));
  const grantsByUser = new Map<string, string[]>();
  for (const grant of grants ?? []) {
    const key = String(grant.user_id);
    grantsByUser.set(key, [...(grantsByUser.get(key) ?? []), String(grant.permission_key)]);
  }
  const grouped = new Map<string, { users: number; permissionSets: Set<string>; lastReview: string }>();
  for (const row of roleRows ?? []) {
    const role = String(row.role ?? "unknown");
    const current = grouped.get(role) ?? { users: 0, permissionSets: new Set<string>(), lastReview: "Not reviewed" };
    current.users += 1;
    for (const permission of grantsByUser.get(String(row.user_id)) ?? []) current.permissionSets.add(permission);
    const date = createdAt.get(String(row.user_id));
    if (date && (current.lastReview === "Not reviewed" || date > current.lastReview)) current.lastReview = date;
    grouped.set(role, current);
  }
  const data = [...grouped.entries()].map(([role, value]) => ({
    role: role[0]?.toUpperCase() + role.slice(1),
    group: role === "admin" ? "System roles" : "Custom roles",
    accessLevel: role === "admin" ? "Full" : "Scoped",
    users: value.users,
    permissionSets: role === "admin" ? ["All permissions"] : [...value.permissionSets],
    lastReview: value.lastReview === "Not reviewed" ? value.lastReview : new Date(value.lastReview).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
    owner: role === "admin" ? "System" : "Staff policy",
    status: "Active" as const,
  }));
  return correlatedJson(cid, { data });
}
