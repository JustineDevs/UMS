"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "./supabase/client";

type AdminSession = { user: { id?: string; email?: string; name?: string | null; image?: string | null; role?: string; permissions?: string[] }; expires: string };
export type StorefrontSession = AdminSession;
type State = { data: AdminSession | null; status: "loading" | "authenticated" | "unauthenticated"; update: (_patch?: { name?: string | null }) => Promise<void> };
const Context = createContext<State>({ data: null, status: "loading", update: async () => {} });
export function SupabaseSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ data: null, status: "loading", update: async () => {} });
  const refresh = async (_patch?: { name?: string | null }) => {
    const response = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
    if (!response.ok) { setState({ data: null, status: "unauthenticated", update: refresh }); return; }
    const session = (await response.json()) as AdminSession | null;
    setState({ data: session, status: session ? "authenticated" : "unauthenticated", update: refresh });
  };
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_AUTH_DISABLED === "true" || process.env.NEXT_PUBLIC_AUTH_DISABLE === "true") { setState({ data: { user: { id: "local-admin", email: "local-admin@example.com", name: "Local admin", role: "admin", permissions: ["*"] }, expires: "2099-01-01T00:00:00.000Z" }, status: "authenticated", update: refresh }); return; }
    void refresh();
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: listener } = supabase.auth.onAuthStateChange(() => { void refresh(); });
      return () => listener.subscription.unsubscribe();
    } catch {
      // Session resolution above still settles the provider when local auth
      // configuration is unavailable; do not leave every protected surface in
      // a permanent loading state.
      return undefined;
    }
  }, []);
  return <Context.Provider value={{ ...state, update: refresh }}>{children}</Context.Provider>;
}
export function useSession() { return useContext(Context); }
export async function signIn(provider: "google", options?: { callbackUrl?: string }, oauthOptions?: { prompt?: string }) { const callback = new URL("/api/auth/callback", window.location.origin); if (options?.callbackUrl?.startsWith("/")) callback.searchParams.set("next", options.callbackUrl); const { error } = await createSupabaseBrowserClient().auth.signInWithOAuth({ provider, options: { redirectTo: callback.toString(), queryParams: oauthOptions?.prompt ? { prompt: oauthOptions.prompt } : undefined } }); if (error) throw error; }
export async function signOut(options?: { callbackUrl?: string }) { await createSupabaseBrowserClient().auth.signOut(); window.location.assign(options?.callbackUrl ?? "/"); }
export async function signInWithPassword(email: string, password: string, callbackUrl: string) {
  const { error } = await createSupabaseBrowserClient().auth.signInWithPassword({ email, password });
  if (error) return { ok: false as const, error: error.message };
  window.location.assign(callbackUrl.startsWith("/") ? callbackUrl : "/admin");
  return { ok: true as const };
}
