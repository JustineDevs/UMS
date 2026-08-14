import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import { checkStaffRole, staffSessionAllows } from "@universal-music-store/database";
import { authOptions } from "./auth";
import { adminSupabaseOr503 } from "./require-admin-supabase";
import { resolveStaffOrganization } from "./staff-organization";

export const authDisabled =
  process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";

export function isAuthDisabled() {
  return authDisabled;
}

function localAdminSession(): Session {
  return {
    user: {
      name: "Local admin",
      // Nango validates end-user email tags even when auth is intentionally bypassed locally.
      email: "local-admin@example.com",
      role: "admin",
    },
    expires: "2099-12-31T23:59:59.999Z",
  } as Session;
}

/** Resolve the same staff session used by shared guards for legacy handlers. */
export async function getStaffSession(): Promise<Session | null> {
  return authDisabled ? localAdminSession() : getServerSession(authOptions);
}

async function authorizeStaffSession(
  permission?: string,
): Promise<
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse }
> {
  const session = await getStaffSession();
  const roleCheck = checkStaffRole(session);
  if (!roleCheck.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: roleCheck.status === 401 ? "Unauthorized" : "Forbidden", code: roleCheck.code },
        { status: roleCheck.status },
      ),
    };
  }
  if (permission && !staffSessionAllows(session, permission)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden", code: "MISSING_PERMISSION" },
        { status: 403 },
      ),
    };
  }
  const supabase = adminSupabaseOr503("staff-authorization");
  if ("response" in supabase) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Admin data service unavailable", code: "ADMIN_DATA_UNAVAILABLE" },
        { status: 503 },
      ),
    };
  }
  const organization = await resolveStaffOrganization(
    supabase.client,
    session?.user?.email,
  );
  if (!organization) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Organization membership is required", code: "ORGANIZATION_REQUIRED" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, session: session as Session };
}

/**
 * Standard guard for `/api/admin/**` route handlers that need RBAC:
 * valid staff session + permission key (admin role resolves to `*` via {@link staffSessionAllows}).
 * Returns the session for audit fields (`session.user.email`).
 */
export async function requireStaffApiSession(
  permission: string,
): Promise<
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse }
> {
  return authorizeStaffSession(permission);
}

/**
 * Authorize a handler that supports more than one permission without weakening
 * production RBAC. This is useful for read endpoints shared by read/write UI.
 */
export async function requireStaffApiSessionAny(
  permissions: readonly string[],
): Promise<
  | { ok: true; session: Session; permission: string }
  | { ok: false; response: NextResponse }
> {
  let lastFailure: { ok: false; response: NextResponse } | undefined;
  for (const permission of permissions) {
    const result = await requireStaffApiSession(permission);
    if (result.ok) return { ...result, permission };
    lastFailure = result;
  }
  return lastFailure ?? {
    ok: false,
    response: NextResponse.json(
      { error: "Forbidden", code: "MISSING_PERMISSION" },
      { status: 403 },
    ),
  };
}

export async function requireStaffSession(): Promise<
  | { ok: true }
  | { ok: false; response: NextResponse }
> {
  const result = await authorizeStaffSession();
  return result.ok ? { ok: true } : result;
}

/**
 * Staff session plus a specific RBAC key (e.g. inventory:read for inventory APIs).
 * Prefer {@link requireStaffApiSession} when the handler needs `session` for audit or actor fields.
 */
export async function requireStaffSessionWithPermission(
  permission: string,
): Promise<
  | { ok: true }
  | { ok: false; response: NextResponse }
> {
  const r = await requireStaffApiSession(permission);
  if (!r.ok) return r;
  return { ok: true };
}
