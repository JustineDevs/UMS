"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "./supabase/client";

export type StorefrontSession = {
  user: { id?: string; email?: string; name?: string | null; image?: string | null };
  expires: string;
};
type SessionState = { data: StorefrontSession | null; status: "loading" | "authenticated" | "unauthenticated" };
const SessionContext = createContext<SessionState>({ data: null, status: "loading" });

export function SupabaseSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ data: null, status: "loading" });
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_AUTH_DISABLED === "true" || process.env.NEXT_PUBLIC_AUTH_DISABLE === "true") {
      setState({ data: { user: { id: "e2e-test-user", email: "e2e-test@example.com", name: "E2E Tester" }, expires: "2099-01-01T00:00:00.000Z" }, status: "authenticated" });
      return;
    }
    // Isolated browser checks and local development may intentionally omit
    // Supabase. Treat that as a signed-out browser, not a permanently loading
    // session, so public flows remain usable and protected routes return 401.
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    ) {
      setState({ data: null, status: "unauthenticated" });
      return;
    }
    // Resolve the session through our same-origin server route. This keeps the
    // browser from making a cross-origin Supabase user request, while the
    // server still validates the real Supabase session from its httpOnly
    // cookies. OAuth and sign-out continue to use the browser client below.
    void fetch("/api/auth/session", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Session request failed (${response.status})`);
        return (await response.json()) as { user?: StorefrontSession["user"] | null; expires?: string };
      })
      .then((payload) => {
        const session = payload.user && payload.expires
          ? { user: payload.user, expires: payload.expires }
          : null;
        setState({ data: session, status: session ? "authenticated" : "unauthenticated" });
      })
      .catch(() => setState({ data: null, status: "unauthenticated" }));
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
