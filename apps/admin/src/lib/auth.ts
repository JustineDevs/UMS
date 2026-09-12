import type { User } from "@supabase/supabase-js";
import { isStaffRole, resolveStaffPermissionsForUserId, tryCreateSupabaseClient, upsertOAuthUser } from "@universal-music-store/database";
import { createSupabaseServerClient } from "./supabase/server";

export type Session = { user: { id?: string; email?: string; name?: string | null; image?: string | null; role?: string; permissions?: string[] }; expires: string };
export const authDisabled = process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";
export function isAuthDisabled() { return authDisabled; }
function localAdminSession(): Session { return { user: { id: "local-admin", name: "Local admin", email: "local-admin@example.com", role: "admin", permissions: ["*"] }, expires: "2099-12-31T23:59:59.999Z" }; }
const cache = new Map<string, { role: string; permissions: string[]; expiresAt: number }>();
const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function enrich(user: User): Promise<Session> {
  const email = normalizeEmail(user.email ?? "");
  const metadata = user.user_metadata as Record<string, unknown>;
  const session: Session = { user: { id: user.id, email, name: typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : null, image: typeof metadata.avatar_url === "string" ? metadata.avatar_url : null }, expires: new Date(Date.now() + 3600_000).toISOString() };
  const cached = cache.get(email);
  if (cached && cached.expiresAt > Date.now()) { session.user.role = cached.role; session.user.permissions = cached.permissions; return session; }
  const supabase = tryCreateSupabaseClient();
  if (!supabase || !email) return session;
  const { data: row } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
  if (!row?.id) return session;
  const [permissions, roleRow] = await Promise.all([resolveStaffPermissionsForUserId(supabase, row.id as string), supabase.from("user_roles").select("role").eq("user_id", row.id).maybeSingle()]);
  const role = (roleRow.data?.role as string | undefined) ?? "customer";
  cache.set(email, { role, permissions, expiresAt: Date.now() + 60_000 });
  session.user.role = role; session.user.permissions = permissions;
  return session;
}

export async function getAdminSession(): Promise<Session | null> {
  if (authDisabled) return localAdminSession();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const session = await enrich(data.user);
  return isStaffRole(session.user.role ?? "") ? session : null;
}

export async function completeAdminOAuth(user: User, googleSub?: string): Promise<Session | null> {
  const supabase = tryCreateSupabaseClient();
  if (!supabase || !user.email) return null;
  const email = normalizeEmail(user.email);
  const allowed = process.env.ADMIN_ALLOWED_EMAILS?.split(",").map(normalizeEmail).filter(Boolean) ?? [];
  const projection = await upsertOAuthUser(supabase, { email, name: typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null, image: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null, googleSub: googleSub ?? user.id }, { promoteEmails: allowed });
  if (!isStaffRole(projection.role)) return null;
  cache.delete(email);
  return enrich(user);
}
