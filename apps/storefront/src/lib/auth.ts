import type { User } from "@supabase/supabase-js";
import { findOrCreateMedusaCustomerIdByEmail } from "@/lib/medusa-customer-resolve";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Session = { user: { id?: string; email?: string; name?: string | null; image?: string | null }; expires: string; authenticatedAt?: number };

export function isStorefrontAuthDisabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return [process.env.AUTH_DISABLED, process.env.AUTH_DISABLE].some((value) => value === "true");
}

function toSession(user: User): Session {
  const metadata = user.user_metadata as Record<string, unknown>;
  const authenticatedAt = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) / 1000 : undefined;
  return { user: { id: user.id, email: user.email, name: typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : null, image: typeof metadata.avatar_url === "string" ? metadata.avatar_url : null }, expires: new Date(Date.now() + 3600_000).toISOString(), ...(authenticatedAt && Number.isFinite(authenticatedAt) ? { authenticatedAt } : {}) };
}

export async function getStorefrontSession(): Promise<Session | null> {
  if (isStorefrontAuthDisabled()) return { user: { id: "e2e-test-user", email: "e2e-test@example.com", name: "Local QA" }, expires: "2099-12-31T23:59:59.999Z" };
  if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_ANON_KEY?.trim()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const session = toSession(data.user);
  if (session.user.email) {
    const customerId = await findOrCreateMedusaCustomerIdByEmail(session.user.email).catch(() => null);
    if (customerId) session.user.id = customerId;
  }
  return session;
}
