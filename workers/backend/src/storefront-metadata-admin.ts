import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
const KEYS = ["storeName", "instagramUrl", "facebookUrl", "tiktokUrl", "youtubeUrl", "xUrl", "linkedinUrl", "whatsappUrl", "messengerUrl", "supportEmail", "supportPhone", "shippingPolicyUrl", "returnsPolicyUrl", "termsUrl", "privacyUrl", "cookiesUrl", "accessibilityUrl", "warrantyPdfUrl"] as const;
type Payload = Record<(typeof KEYS)[number], string>;
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function allowed(claims: WorkerAuthClaims, write: boolean): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; const needed = write ? "settings:write" : "settings:read"; return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === needed); }
function merge(value: unknown): Payload | null { const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; if (Object.keys(input).some((key) => !(KEYS as readonly string[]).includes(key)) || KEYS.some((key) => input[key] !== undefined && (typeof input[key] !== "string" || input[key].length > 2048))) return null; return Object.fromEntries(KEYS.map((key) => [key, typeof input[key] === "string" ? input[key].trim() : ""])) as Payload; }

export async function handleAdminStorefrontMetadataRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "PUT") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!allowed(claims, request.method === "PUT")) return json({ error: "forbidden" }, 403);
  if (request.method === "GET") {
    const result = await database.query<{ payload: unknown }>("SELECT payload FROM public.storefront_public_metadata WHERE id=$1 LIMIT 1", ["default"]);
    return json({ data: merge(result.rows[0]?.payload) ?? merge({}) });
  }
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key) return json({ error: "idempotency_key_required" }, 400);
  let payload: Payload;
  try { const body = await request.json() as unknown; if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_metadata_payload" }, 400); const parsed = merge(body); if (!parsed) return json({ error: "invalid_metadata_payload" }, 400); payload = parsed; } catch { return json({ error: "invalid_json" }, 400); }
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload))))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `storefront-metadata:${claims.sub}:${key}`, hash, async () => {
    await database.query("INSERT INTO public.storefront_public_metadata (id,payload,updated_at) VALUES ($1,$2::jsonb,now()) ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now()", ["default", JSON.stringify(payload)]);
    return json({ data: payload });
  })).response;
}
