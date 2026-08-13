import type { StorefrontShippingAddress } from "@universal-music-store/validation";
import { storefrontCustomerProfilePatchSchema } from "@universal-music-store/validation";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import type { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";

type SessionLike = {
  user?: {
    email?: string | null;
  } | null;
} | null;

type ProfilePatchDependencies = {
  getSession: () => Promise<SessionLike>;
  createStorefrontServiceSupabase: typeof createStorefrontServiceSupabase;
};

export async function handleStorefrontProfilePatchRequest(
  req: Request,
  deps: ProfilePatchDependencies,
): Promise<Response> {
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`profile-patch:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const session = await deps.getSession();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = storefrontCustomerProfilePatchSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    const first =
      Object.values(msg).flat()[0] ?? "Check your profile fields and try again.";
    return Response.json({ error: first }, { status: 400 });
  }

  const sb = deps.createStorefrontServiceSupabase();
  if (!sb) {
    return Response.json(
      { error: "Profile save is not available right now." },
      { status: 503 },
    );
  }

  const v = parsed.data;
  const shipping_addresses = (v.shippingAddresses ??
    []) as StorefrontShippingAddress[];

  const { error } = await sb.from("storefront_customer_profiles").upsert(
    {
      email,
      display_name: v.displayName?.trim() || null,
      phone: v.phone?.trim() || null,
      avatar_url: v.avatarUrl?.trim() || null,
      shipping_addresses,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email" },
  );

  if (error) {
    return Response.json({ error: "Unable to save profile." }, { status: 503 });
  }

  return Response.json({ ok: true });
}
