import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken } from "./auth.ts";

type ProfileEnv = { JWT_SECRET?: string; SUPABASE_URL?: string };
type ProfileRow = {
  email: string;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  shipping_addresses: unknown;
  updated_at: string;
};

function authenticatedEmail(claims: Record<string, unknown>): string | null {
  const email = claims.email;
  return typeof email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
    ? email.trim().toLowerCase()
    : null;
}

export async function handleCustomerProfileRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: ProfileEnv,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "PUT")
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  const claims = await verifyWorkerBearerToken(
    request.headers.get("Authorization"),
    { secret: env.JWT_SECRET, supabaseUrl: env.SUPABASE_URL },
  );
  if (!claims)
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  const accountEmail = authenticatedEmail(claims);
  if (!accountEmail)
    return new Response(JSON.stringify({ error: "email_claim_required" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  if (request.method === "PUT") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return new Response(JSON.stringify({ error: "invalid_profile" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    const input = body as Record<string, unknown>;
    const inputEmail =
      typeof input.email === "string" ? input.email.trim().toLowerCase() : accountEmail;
    const displayName =
      input.display_name === null
        ? null
        : typeof input.display_name === "string"
          ? input.display_name.trim()
          : undefined;
    const phone =
      input.phone === null
        ? null
        : typeof input.phone === "string"
          ? input.phone.trim()
          : undefined;
    const avatarUrl =
      input.avatar_url === null
        ? null
        : typeof input.avatar_url === "string"
          ? input.avatar_url.trim()
          : undefined;
    const addresses = input.shipping_addresses;
    if (
      inputEmail !== accountEmail ||
      (typeof displayName === "string" && displayName.length > 160) ||
      (typeof phone === "string" && phone.length > 32) ||
      (typeof avatarUrl === "string" && avatarUrl.length > 2048) ||
      (addresses !== undefined &&
        (!Array.isArray(addresses) ||
          JSON.stringify(addresses).length > 32_000))
    )
      return new Response(JSON.stringify({ error: "invalid_profile" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    const result = await database.query<ProfileRow>(
      `INSERT INTO public.storefront_customer_profiles (email, display_name, phone, shipping_addresses, avatar_url, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $9, now())
       ON CONFLICT (email) DO UPDATE SET
         display_name = CASE WHEN $5::boolean THEN EXCLUDED.display_name ELSE storefront_customer_profiles.display_name END,
         phone = CASE WHEN $6::boolean THEN EXCLUDED.phone ELSE storefront_customer_profiles.phone END,
         shipping_addresses = CASE WHEN $7::boolean THEN EXCLUDED.shipping_addresses ELSE storefront_customer_profiles.shipping_addresses END,
         avatar_url = CASE WHEN $8::boolean THEN EXCLUDED.avatar_url ELSE storefront_customer_profiles.avatar_url END,
         updated_at = now()
       RETURNING email, display_name, phone, avatar_url, shipping_addresses, updated_at`,
      [
        accountEmail,
        displayName ?? null,
        phone ?? null,
        JSON.stringify(addresses ?? null),
        Object.prototype.hasOwnProperty.call(input, "display_name"),
        Object.prototype.hasOwnProperty.call(input, "phone"),
        Object.prototype.hasOwnProperty.call(input, "shipping_addresses"),
        Object.prototype.hasOwnProperty.call(input, "avatar_url"),
        avatarUrl ?? null,
      ],
    );
    return new Response(JSON.stringify({ profile: result.rows[0] ?? null }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }
  const result = await database.query<ProfileRow>(
    `SELECT email, display_name, phone, avatar_url, shipping_addresses, updated_at
     FROM public.storefront_customer_profiles WHERE email = $1`,
    [accountEmail],
  );
  return new Response(JSON.stringify({ profile: result.rows[0] ?? null }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
