import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken } from "./auth.ts";

type MarketingPreferencesEnv = {
  JWT_SECRET?: string;
  SUPABASE_URL?: string;
  DEFAULT_ORGANIZATION_ID?: string;
};

const NOTIFICATION_CHANNELS = [
  "email",
  "order_updates",
  "back_in_stock",
  "promotions",
  "wallet",
  "platform_updates",
] as const;
type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

type MarketingPreferenceRow = {
  channel: NotificationChannel;
  consent_status: "subscribed" | "unsubscribed";
  source: string;
  consented_at: string | null;
  unsubscribed_at: string | null;
  updated_at: string;
};

function notificationChannel(value: unknown): NotificationChannel {
  return typeof value === "string" && (NOTIFICATION_CHANNELS as readonly string[]).includes(value)
    ? value as NotificationChannel
    : "email";
}

function accountEmail(claims: Record<string, unknown>): string | null {
  const email = claims.email;
  return typeof email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
    ? email.trim().toLowerCase()
    : null;
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Cache-Control": "no-store", "Content-Type": "application/json" },
  });
}

export async function handleCustomerMarketingPreferencesRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: MarketingPreferencesEnv,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "PATCH") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), {
    secret: env.JWT_SECRET,
    supabaseUrl: env.SUPABASE_URL,
  });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const email = accountEmail(claims);
  if (!email) return json({ error: "email_claim_required" }, 403);
  const organizationId = env.DEFAULT_ORGANIZATION_ID?.trim() || null;
  if (!organizationId) return json({ error: "organization_not_configured" }, 503);

  if (request.method === "PATCH") {
    let body: unknown;
    try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_preferences" }, 400);
    const input = body as Record<string, unknown>;
    const subscribed = input.subscribed;
    if (typeof subscribed !== "boolean") return json({ error: "subscribed_boolean_required" }, 400);
    const channel = notificationChannel(input.channel);
    const result = await database.query<MarketingPreferenceRow>(
      `INSERT INTO public.marketing_preferences
         (organization_id, email, channel, consent_status, source, consented_at, unsubscribed_at, updated_at)
       VALUES ($1, $2, $3, $4, 'account_preferences', CASE WHEN $4 = 'subscribed' THEN now() ELSE NULL END, CASE WHEN $4 = 'unsubscribed' THEN now() ELSE NULL END, now())
       ON CONFLICT (organization_id, email, channel) DO UPDATE SET
         consent_status = EXCLUDED.consent_status,
         source = EXCLUDED.source,
         consented_at = CASE WHEN EXCLUDED.consent_status = 'subscribed' THEN now() ELSE marketing_preferences.consented_at END,
         unsubscribed_at = CASE WHEN EXCLUDED.consent_status = 'unsubscribed' THEN now() ELSE NULL END,
         updated_at = now()
       RETURNING channel, consent_status, source, consented_at, unsubscribed_at, updated_at`,
      [organizationId, email, channel, subscribed ? "subscribed" : "unsubscribed"],
    );
    return json({ preference: result.rows[0] ?? null });
  }

  const result = await database.query<MarketingPreferenceRow>(
    `SELECT channel, consent_status, source, consented_at, unsubscribed_at, updated_at
       FROM public.marketing_preferences
      WHERE organization_id IS NOT DISTINCT FROM $1 AND lower(email) = $2
      ORDER BY channel`,
    [organizationId, email],
  );
  return json({
    preference: result.rows.find((row) => row.channel === "email") ?? null,
    preferences: result.rows,
  });
}
