"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "./supabase/client";

export type StorefrontSession = {
  user: { id?: string; email?: string; name?: string | null; image?: string | null };
  expires: string;
};
type SessionState = { data: StorefrontSession | null; status: "loading" | "authenticated" | "unauthenticated" };
const SessionContext = createContext<SessionState>({ data: null, status: "loading" });

function mapUser(user: User | null): StorefrontSession | null {
  if (!user) return null;
  const metadata = user.user_metadata as Record<string, unknown>;
  return {
    user: { id: user.id, email: user.email, name: typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : null, image: typeof metadata.avatar_url === "string" ? metadata.avatar_url : null },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  };
}

export function SupabaseSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ data: null, status: "loading" });
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_AUTH_DISABLED === "true" || process.env.NEXT_PUBLIC_AUTH_DISABLE === "true") {
      setState({ data: { user: { id: "e2e-test-user", email: "e2e-test@example.com", name: "E2E Tester" }, expires: "2099-01-01T00:00:00.000Z" }, status: "authenticated" });
      return;
    }
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(({ data }) => {
      const session = mapUser(data.user);
      setState({ data: session, status: session ? "authenticated" : "unauthenticated" });
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const mapped = mapUser(session?.user ?? null);
      setState({ data: mapped, status: mapped ? "authenticated" : "unauthenticated" });
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() { return useContext(SessionContext); }

export async function signIn(provider: "google", options?: { callbackUrl?: string }, oauthOptions?: { prompt?: string }) {
  const supabase = createSupabaseBrowserClient();
  const callback = new URL("/api/auth/callback", window.location.origin);
  const next = options?.callbackUrl;
  if (next?.startsWith("/")) callback.searchParams.set("next", next);
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: callback.toString(), queryParams: oauthOptions?.prompt ? { prompt: oauthOptions.prompt } : undefined } });
  if (error) throw error;
}

export async function signOut(options?: { callbackUrl?: string }) {
  await createSupabaseBrowserClient().auth.signOut();
  window.location.assign(options?.callbackUrl ?? "/");
}
