import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
type UserRow = { id: string; created_at: string | null };
type RoleRow = { user_id: string; role: string | null };
type GrantRow = { user_id: string; permission_key: string | null };

function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function canRead(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "employees:read"); }

export async function handleAdminRolesRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!canRead(claims)) return json({ error: "forbidden" }, 403);
  const [users, roles, grants] = await Promise.all([
    database.query<UserRow>("SELECT id, created_at FROM public.users ORDER BY created_at DESC LIMIT 5000"),
    database.query<RoleRow>("SELECT user_id, role::text AS role FROM public.user_roles LIMIT 5000"),
    database.query<GrantRow>("SELECT user_id, permission_key FROM public.staff_permission_grants LIMIT 10000"),
  ]);
  const createdAt = new Map(users.rows.map((user) => [String(user.id), user.created_at]));
  const grantsByUser = new Map<string, string[]>();
  for (const grant of grants.rows) { const key = String(grant.user_id); if (grant.permission_key) grantsByUser.set(key, [...(grantsByUser.get(key) ?? []), grant.permission_key]); }
  const grouped = new Map<string, { users: number; permissions: Set<string>; lastReview: string }>();
  for (const row of roles.rows) {
    const role = String(row.role ?? "unknown"); const current = grouped.get(role) ?? { users: 0, permissions: new Set<string>(), lastReview: "Not reviewed" };
    current.users += 1; for (const permission of grantsByUser.get(String(row.user_id)) ?? []) current.permissions.add(permission);
    const date = createdAt.get(String(row.user_id)); if (date && (current.lastReview === "Not reviewed" || date > current.lastReview)) current.lastReview = date; grouped.set(role, current);
  }
  const formatter = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" });
  const data = [...grouped.entries()].map(([role, value]) => ({ role: role[0]?.toUpperCase() + role.slice(1), group: role === "admin" ? "System roles" : "Custom roles", accessLevel: role === "admin" ? "Full" : "Scoped", users: value.users, permissionSets: role === "admin" ? ["All permissions"] : [...value.permissions], lastReview: value.lastReview === "Not reviewed" ? value.lastReview : formatter.format(new Date(value.lastReview)), owner: role === "admin" ? "System" : "Staff policy", status: "Active" }));
  return json({ data });
}
