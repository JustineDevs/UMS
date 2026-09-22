import { verifyWorkerBearerToken } from "./auth.ts";
import type { WorkerDatabaseClient } from "./database.ts";

export type WorkerStaffPrincipal = {
  email: string;
  userId: string;
  organizationId: string;
  organizationRole: string;
  permissions: string[];
};

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string; fetch?: typeof fetch };

function error(status: number, code: string): Response {
  return Response.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
}

export function workerStaffHasPermission(principal: WorkerStaffPrincipal, permission: string): boolean {
  return principal.permissions.includes("*") || principal.permissions.includes(permission);
}

export async function resolveWorkerStaffPrincipal(
  request: Request,
  database: WorkerDatabaseClient,
  env: Env,
): Promise<WorkerStaffPrincipal | Response> {
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), {
    secret: env.CMS_ADMIN_JWT_SECRET,
    supabaseUrl: env.SUPABASE_URL,
    fetch: env.fetch,
  });
  const email = typeof claims?.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!claims || !email) return error(401, "unauthorized");

  const users = await database.query<{ id: string }>(
    "SELECT id::text AS id FROM public.users WHERE lower(email) = $1 LIMIT 2",
    [email],
  );
  if (users.rows.length !== 1) return error(403, "staff_not_configured");
  const userId = users.rows[0].id;
  const [memberships, roles] = await Promise.all([
    database.query<{ organization_id: string; role: string }>(
      "SELECT organization_id, role FROM public.organization_memberships WHERE auth_user_id = $1 AND active = true LIMIT 2",
      [userId],
    ),
    database.query<{ role: string }>(
      "SELECT role::text AS role FROM public.user_roles WHERE user_id = $1::uuid LIMIT 1",
      [userId],
    ),
  ]);
  const role = roles.rows[0]?.role;
  if (memberships.rows.length !== 1 || !["admin", "staff"].includes(role ?? "")) {
    return error(403, "staff_role_required");
  }
  const permissions = role === "admin"
    ? ["*"]
    : (await database.query<{ permission_key: string }>(
      "SELECT permission_key FROM public.staff_permission_grants WHERE user_id = $1::uuid ORDER BY permission_key LIMIT 100",
      [userId],
    )).rows.map((row) => row.permission_key);

  return {
    email,
    userId,
    organizationId: memberships.rows[0].organization_id,
    organizationRole: memberships.rows[0].role,
    permissions,
  };
}
