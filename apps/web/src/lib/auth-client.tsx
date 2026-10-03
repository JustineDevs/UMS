"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "./supabase/client";

type AdminSession = { user: { id?: string; email?: string; name?: string | null; image?: string | null; role?: string; permissions?: string[] }; expires: string };
type State = { data: AdminSession | null; status: "loading" | "authenticated" | "unauthenticated"; update: (_patch?: { name?: string | null }) => Promise<void> };
const Context = createContext<State>({ data: null, status: "loading", update: async () => {} });
export function SupabaseSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ data: null, status: "loading", update: async () => {} });
  const refresh = useCallback(async (_patch?: { name?: string | null }) => {
    try {
      const response = await fetch("/api/auth/session", {
        credentials: "include",
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) { setState({ data: null, status: "unauthenticated", update: refresh }); return; }
      const session = (await response.json()) as AdminSession | null;
      setState({ data: session, status: session ? "authenticated" : "unauthenticated", update: refresh });
    } catch {
      setState({ data: null, status: "unauthenticated", update: refresh });
    }
  }, []);
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
  const contextValue = useMemo(() => ({ ...state, update: refresh }), [refresh, state]);
  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
}
export function useSession() { return useContext(Context); }
