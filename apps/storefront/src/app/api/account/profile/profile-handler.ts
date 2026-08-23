import type { StorefrontShippingAddress } from "@universal-music-store/validation";
import { storefrontCustomerProfilePatchSchema } from "@universal-music-store/validation";
import {
  findMedusaCustomerIdByEmail,
  syncMedusaCustomerProfile,
} from "@/lib/medusa-customer-resolve";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import type { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { hasRecentAuthentication } from "@/lib/recent-auth";

const MAX_PROFILE_BODY_BYTES = 32 * 1024;

type SessionLike = {
  authenticatedAt?: number;
  user?: {
    email?: string | null;
    medusaCustomerId?: string | null;
  } | null;
} | null;

type ProfilePatchDependencies = {
  getSession: () => Promise<SessionLike>;
  createStorefrontServiceSupabase: typeof createStorefrontServiceSupabase;
  findMedusaCustomerIdByEmail?: typeof findMedusaCustomerIdByEmail;
  syncMedusaCustomerProfile?: typeof syncMedusaCustomerProfile;
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
  const authDisabled = process.env.AUTH_DISABLED === "true" || process.env.AUTH_DISABLE === "true";
  if (!authDisabled && !hasRecentAuthentication(session)) {
    return Response.json(
      {
        error: "Please sign in again before changing your profile or addresses.",
        code: "RECENT_AUTH_REQUIRED",
        reauthUrl: "/sign-in?callbackUrl=%2Faccount&reauth=1",
      },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const bounded = await parseBoundedJson(req, MAX_PROFILE_BODY_BYTES);
  if (bounded.tooLarge) {
    return Response.json({ error: "Request body is too large" }, { status: 413 });
  }
  if (!bounded.valid) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = bounded.value;
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
  const medusaCustomerId =
    session?.user?.medusaCustomerId?.trim() ||
    (await (deps.findMedusaCustomerIdByEmail ?? findMedusaCustomerIdByEmail)(email)) ||
    null;

  // Email is the table's canonical identity and primary key. Medusa ID is a
  // secondary identity used for reconciliation, not for profile writes.
  const profileKey = { key: "email", value: email } as const;
  const profileRow = {
    ...(medusaCustomerId ? { medusa_customer_id: medusaCustomerId } : {}),
    email,
    display_name: v.displayName?.trim() || null,
    phone: v.phone?.trim() || null,
    avatar_url: v.avatarUrl?.trim() || null,
    shipping_addresses,
    updated_at: new Date().toISOString(),
  };
  if (v.updatedAt) {
    const { data: previous, error: readError } = await sb
      .from("storefront_customer_profiles")
      .select("medusa_customer_id,email,display_name,phone,avatar_url,shipping_addresses,updated_at")
      .eq(profileKey.key, profileKey.value)
      .eq("updated_at", v.updatedAt)
      .maybeSingle();
    if (readError) return Response.json({ error: "Unable to save profile." }, { status: 503 });
    if (!previous) {
      return Response.json({ error: "Profile changed in another tab. Reload before saving again." }, { status: 409 });
    }

    const { data: updated, error } = await sb
      .from("storefront_customer_profiles")
      .update(profileRow)
      .eq(profileKey.key, profileKey.value)
      .eq("updated_at", v.updatedAt)
      .select("email")
      .maybeSingle();
    if (error) return Response.json({ error: "Unable to save profile." }, { status: 503 });
    if (!updated) {
      return Response.json({ error: "Profile changed in another tab. Reload before saving again." }, { status: 409 });
    }

    let synced = false;
    try {
      synced = await (deps.syncMedusaCustomerProfile ?? syncMedusaCustomerProfile)(medusaCustomerId, v);
    } catch {
      synced = false;
    }
    if (!synced) {
      await sb
        .from("storefront_customer_profiles")
        .update(previous)
        .eq(profileKey.key, profileKey.value)
        .eq("updated_at", profileRow.updated_at);
      return Response.json(
        { error: "Customer profile service is unavailable. Nothing was saved." },
        { status: 503 },
      );
    }
  } else {
    let synced = false;
    try {
      synced = await (deps.syncMedusaCustomerProfile ?? syncMedusaCustomerProfile)(medusaCustomerId, v);
    } catch {
      synced = false;
    }
    if (!synced) {
      return Response.json(
        { error: "Customer profile service is unavailable. Nothing was saved." },
        { status: 503 },
      );
    }
    const { error } = await sb.from("storefront_customer_profiles").upsert(profileRow, {
      onConflict: "email",
    });
    if (error) return Response.json({ error: "Unable to save profile." }, { status: 503 });
  }

  return Response.json({ ok: true, updatedAt: profileRow.updated_at });
}
