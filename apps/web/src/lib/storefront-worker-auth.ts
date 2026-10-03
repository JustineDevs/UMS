import { createHmac } from "node:crypto";

import { getE2eSessionEmail } from "./e2e-session";
import { getStorefrontSession } from "./auth";
import { createSupabaseServerClient } from "./supabase/server";

export type StorefrontWorkerAuth = {
  email: string;
  token: string;
  e2eSession: boolean;
};

function internalStorefrontToken(userId: string, email: string): string | null {
  // The production-mode local harness still uses the signed E2E session
  // fixture. Keep this token path unavailable on Vercel, while allowing the
  // local production build to exercise the same Worker-facing routes.
  if (
    process.env.VERCEL === "1" ||
    (process.env.UVS_E2E_LOCAL !== "1" && process.env.NODE_ENV !== "development")
  ) return null;
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) return null;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    sub: userId,
    email,
    scope: "storefront:profile",
    iss: "uvs.internal",
    aud: "uvs-worker",
    exp: Math.floor(Date.now() / 1000) + 60,
  });
  const signingInput = `${header}.${payload}`;
  return `${signingInput}.${createHmac("sha256", secret).update(signingInput).digest("base64url")}`;
}

/** Resolve the browser's Supabase session, with the local real-session fixture fallback. */
export async function getStorefrontWorkerAuth(): Promise<StorefrontWorkerAuth | null> {
  const supabase = await createSupabaseServerClient();
  const [{ data: userData }, { data: sessionData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  const user = userData.user;
  let token = sessionData.session?.access_token?.trim();
  let email = user?.email?.trim().toLowerCase();
  let e2eSession = false;

  if (!token) {
    const session = await getStorefrontSession();
    const e2eEmail = await getE2eSessionEmail();
    const sessionEmail = session?.user.email?.trim().toLowerCase();
    if (session?.user.id && sessionEmail && e2eEmail === sessionEmail) {
      token = internalStorefrontToken(session.user.id, sessionEmail) ?? undefined;
      email = sessionEmail;
      e2eSession = Boolean(token);
    }
  }

  if (!email || !token) return null;
  return { email, token, e2eSession };
}
