import { createSupabaseBrowserClient } from "./supabase/client";

export async function signIn(provider: "google", options?: { callbackUrl?: string }, oauthOptions?: { prompt?: string }) {
  const callback = new URL("/api/auth/callback", window.location.origin);
  callback.searchParams.set("origin", window.location.origin);
  if (options?.callbackUrl?.startsWith("/")) callback.searchParams.set("next", options.callbackUrl);
  const { error } = await createSupabaseBrowserClient().auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callback.toString(),
      queryParams: oauthOptions?.prompt ? { prompt: oauthOptions.prompt } : undefined,
    },
  });
  if (error) throw error;
}

export async function signOut(options?: { callbackUrl?: string }) {
  await Promise.allSettled([
    createSupabaseBrowserClient().auth.signOut(),
    fetch("/api/auth/e2e", { method: "DELETE", credentials: "include", cache: "no-store" }),
  ]);
  window.location.assign(options?.callbackUrl ?? "/");
}
