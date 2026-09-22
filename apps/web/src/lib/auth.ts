import type { User } from "@supabase/supabase-js";
import { isStaffRole, resolveStaffPermissionsForUserId, tryCreateSupabaseClient, upsertOAuthUser } from "@universal-music-store/database";
import { createSupabaseServerClient } from "./supabase/server";
import { getE2eSessionEmail } from "./e2e-session";

export type Session = { user: { id?: string; email?: string; name?: string | null; image?: string | null; role?: string; permissions?: string[] }; expires: string; authenticatedAt?: number };
const localE2eAuthDisabled =
  process.env.UVS_E2E_LOCAL === "1" && process.env.VERCEL !== "1";
const authDisabled =
  localE2eAuthDisabled ||
  (process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production");
export function isStorefrontAuthDisabled() {
  if (localE2eAuthDisabled) return true;
  if (process.env.NODE_ENV === "production") return false;
  return [
    process.env.AUTH_DISABLED,
    process.env.AUTH_DISABLE,
    process.env.NEXT_PUBLIC_AUTH_DISABLED,
    process.env.NEXT_PUBLIC_AUTH_DISABLE,
  ].some((value) => value === "true");
}
function localAdminSession(): Session { return { user: { id: "local-admin", name: "Local admin", email: "local-admin@example.com", role: "admin", permissions: ["*"] }, expires: "2099-12-31T23:59:59.999Z" }; }

type StaffClaims = { role: string; permissions: string[] };
type AuthEnrichmentCacheEntry = StaffClaims & { expiresAt: number };

const AUTH_ENRICHMENT_CACHE_TTL_MS = 60_000;
export const AUTH_ENRICHMENT_CACHE_MAX_ENTRIES = 1_000;

export interface AuthEnrichmentCache {
  get(_key: string, _now?: number): StaffClaims | undefined;
  set(_key: string, _value: StaffClaims, _now?: number): void;
  delete(_key: string): void;
  clear(): void;
  size(_now?: number): number;
}

export function createAuthEnrichmentCache(options?: {
  maxEntries?: number;
  ttlMs?: number;
}): AuthEnrichmentCache {
  const requestedMaxEntries = options?.maxEntries ?? AUTH_ENRICHMENT_CACHE_MAX_ENTRIES;
  const requestedTtlMs = options?.ttlMs ?? AUTH_ENRICHMENT_CACHE_TTL_MS;
  const maxEntries = Number.isFinite(requestedMaxEntries)
    ? Math.max(1, Math.floor(requestedMaxEntries))
    : AUTH_ENRICHMENT_CACHE_MAX_ENTRIES;
  const ttlMs = Number.isFinite(requestedTtlMs)
    ? Math.max(1, Math.floor(requestedTtlMs))
    : AUTH_ENRICHMENT_CACHE_TTL_MS;
  const entries = new Map<string, AuthEnrichmentCacheEntry>();

  function pruneExpired(now: number): void {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) entries.delete(key);
    }
  }

  return {
    get(key, now = Date.now()) {
      const entry = entries.get(key);
      if (!entry || entry.expiresAt <= now) {
        if (entry) entries.delete(key);
        return undefined;
      }
      // Refresh insertion order so capacity eviction removes the least recently used entry.
      entries.delete(key);
      entries.set(key, entry);
      return { role: entry.role, permissions: entry.permissions };
    },
    set(key, value, now = Date.now()) {
      pruneExpired(now);
      entries.delete(key);
      while (entries.size >= maxEntries) {
        const oldestKey = entries.keys().next().value as string | undefined;
        if (oldestKey === undefined) break;
        entries.delete(oldestKey);
      }
      entries.set(key, { ...value, expiresAt: now + ttlMs });
    },
    delete(key) {
      entries.delete(key);
    },
    clear() {
      entries.clear();
    },
    size(now = Date.now()) {
      pruneExpired(now);
      return entries.size;
    },
  };
}

const cache = createAuthEnrichmentCache();
const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function enrich(user: User): Promise<Session> {
  const email = normalizeEmail(user.email ?? "");
  const metadata = user.user_metadata as Record<string, unknown>;
  const session: Session = { user: { id: user.id, email, name: typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : null, image: typeof metadata.avatar_url === "string" ? metadata.avatar_url : null }, expires: new Date(Date.now() + 3600_000).toISOString() };
  const cached = cache.get(email);
  if (cached) { session.user.role = cached.role; session.user.permissions = cached.permissions; return session; }
  const supabase = tryCreateSupabaseClient();
  if (!supabase || !email) return session;
  const { data: row } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
  if (!row?.id) return session;
  const [permissions, roleRow] = await Promise.all([resolveStaffPermissionsForUserId(supabase, row.id as string), supabase.from("user_roles").select("role").eq("user_id", row.id).maybeSingle()]);
  const role = (roleRow.data?.role as string | undefined) ?? "customer";
  cache.set(email, { role, permissions });
  session.user.role = role; session.user.permissions = permissions;
  return session;
}

async function getLocalE2eSession(): Promise<Session | null> {
  const email = await getE2eSessionEmail();
  if (!email) return null;
  const supabase = tryCreateSupabaseClient();
  if (!supabase) return null;
  const { data: row } = await supabase.from("users").select("id,email").eq("email", email).maybeSingle();
  if (!row?.id) return null;
  const [permissions, roleRow] = await Promise.all([
    resolveStaffPermissionsForUserId(supabase, row.id as string),
    supabase.from("user_roles").select("role").eq("user_id", row.id).maybeSingle(),
  ]);
  return {
    user: {
      id: row.id as string,
      email,
      role: (roleRow.data?.role as string | undefined) ?? "customer",
      permissions,
    },
    expires: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  };
}

export async function getAdminSession(): Promise<Session | null> {
  const localE2e = await getLocalE2eSession();
  if (localE2e && isStaffRole(localE2e.user.role ?? "")) return localE2e;
  if (authDisabled) return localAdminSession();
  if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_ANON_KEY?.trim()) return null;
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

/** Returns an authenticated user for public routes, enriched with staff claims when applicable. */
export async function getStorefrontSession(): Promise<Session | null> {
  const localE2e = await getLocalE2eSession();
  if (localE2e) return localE2e;
  if (authDisabled) return { user: { id: "e2e-test-user", email: "e2e-test@example.com", name: "Local QA" }, expires: "2099-12-31T23:59:59.999Z" };
  if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_ANON_KEY?.trim()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return enrich(data.user);
}

export async function getUnifiedSession(): Promise<Session | null> {
  return (await getAdminSession()) ?? getStorefrontSession();
}
