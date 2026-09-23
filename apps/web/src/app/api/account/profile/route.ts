import { withBotIdProtection } from "@/lib/botid-protection";
import { isSameOriginMutation } from "@/lib/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { storefrontCustomerProfilePatchSchema } from "@universal-music-store/validation";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { hasRecentAuthentication } from "@/lib/recent-auth";
import { isStorefrontAuthDisabled } from "@/lib/auth";
import { readResponseJson } from "@/lib/read-response-json";
import { accountProfilePatchResponseSchema } from "@/lib/admin-api-contracts";
import { getStorefrontSession } from "@/lib/auth";
import { getE2eSessionEmail } from "@/lib/e2e-session";
import { createHmac } from "node:crypto";

export const dynamic = "force-dynamic";

function internalStorefrontToken(userId: string, email: string): string | null {
  if (process.env.NODE_ENV === "production") return null;
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

async function patchWorkerProfile(req: Request): Promise<Response> {
  const baseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) return Response.json({ error: "Profile service is not configured", code: "WORKER_API_URL_MISSING" }, { status: 503 });
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
  if (!email || !token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const authenticatedAt = user?.last_sign_in_at ? Date.parse(user.last_sign_in_at) / 1000 : undefined;
  if (!e2eSession && !hasRecentAuthentication({ authenticatedAt })) {
    return Response.json(
      {
        error: "Please sign in again before changing your profile or addresses.",
        code: "RECENT_AUTH_REQUIRED",
        reauthUrl: "/sign-in?callbackUrl=%2Faccount&reauth=1",
      },
      { status: 401 },
    );
  }
  const bounded = await parseBoundedJson(req, 32 * 1024);
  if (bounded.tooLarge) return Response.json({ error: "Request body is too large" }, { status: 413 });
  if (!bounded.valid) return Response.json({ error: "Invalid JSON" }, { status: 400 });
  const parsed = storefrontCustomerProfilePatchSchema.safeParse(bounded.value);
  if (!parsed.success) return Response.json({ error: "Check your profile fields and try again." }, { status: 400 });
  const value = parsed.data;
  const response = await fetch(`${baseUrl}/store/customers/me`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email,
      ...(value.displayName !== undefined ? { display_name: value.displayName } : {}),
      ...(value.phone !== undefined ? { phone: value.phone } : {}),
      ...(value.avatarUrl !== undefined ? { avatar_url: value.avatarUrl } : {}),
      ...(value.shippingAddresses !== undefined ? { shipping_addresses: value.shippingAddresses } : {}),
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await readResponseJson(response, { error: "invalid_worker_response" });
    const error = payload && typeof payload === "object" ? payload as { error?: unknown; code?: unknown; reauthUrl?: unknown } : {};
    return Response.json(
      {
        error: typeof error.error === "string" ? error.error : "Unable to save profile.",
        ...(typeof error.code === "string" ? { code: error.code } : {}),
        ...(typeof error.reauthUrl === "string" ? { reauthUrl: error.reauthUrl } : {}),
      },
      { status: response.status >= 500 ? 503 : response.status },
    );
  }
  const payload = await readResponseJson(response, { error: "invalid_worker_response" });
  const updatedAt = payload && typeof payload === "object" && "profile" in payload
    ? (payload.profile as { updated_at?: unknown } | null)?.updated_at
    : undefined;
  return Response.json(accountProfilePatchResponseSchema.parse({ ok: true, ...(typeof updatedAt === "string" ? { updatedAt } : {}) }));
}

async function handlePATCH(req: Request) {
  if (!isSameOriginMutation(req)) {
    return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  try {
    if (isStorefrontAuthDisabled() && process.env.VERCEL !== "1") {
      const bounded = await parseBoundedJson(req, 32 * 1024);
      if (bounded.tooLarge) return Response.json({ error: "Request body is too large" }, { status: 413 });
      if (!bounded.valid) return Response.json({ error: "Invalid JSON" }, { status: 400 });
      if (!storefrontCustomerProfilePatchSchema.safeParse(bounded.value).success) {
        return Response.json({ error: "Check your profile fields and try again." }, { status: 400 });
      }
      return Response.json(accountProfilePatchResponseSchema.parse({ ok: true, updatedAt: new Date().toISOString() }));
    }
    return await patchWorkerProfile(req);
  } catch (error) {
    const correlationId = crypto.randomUUID();
    console.error("Worker profile update failed", { correlationId, error: error instanceof Error ? error.message : "unknown" });
    return Response.json({ error: "Profile save is not available right now.", correlationId }, { status: 503 });
  }
}

export const PATCH = withBotIdProtection(handlePATCH);
