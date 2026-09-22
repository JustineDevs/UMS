import type { WorkerDatabaseClient } from "./database.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";
import { resolveWorkerStaffPrincipal, workerStaffHasPermission, type WorkerStaffPrincipal } from "./staff-principal.ts";

type Env = {
  SUPABASE_URL?: string;
  NANGO_API_KEY?: string;
  NANGO_PAYMENT_INTEGRATIONS?: string;
  NANGO_CRM_INTEGRATIONS?: string;
  UVS_MERCHANT_COUNTRY?: string;
  fetch?: typeof fetch;
};
type Principal = WorkerStaffPrincipal;
type NangoConnection = { connection_id?: unknown; provider_config_key?: unknown; provider?: unknown; updated_at?: unknown; tags?: Record<string, unknown>; errors?: unknown };

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
function configured(env: Env, kind: "payment" | "crm"): string[] {
  const raw = kind === "payment" ? env.NANGO_PAYMENT_INTEGRATIONS : env.NANGO_CRM_INTEGRATIONS;
  return [...new Set((raw ?? "").split(",").map((entry) => entry.trim()).filter(Boolean))];
}
function validRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function bounded(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
}
function permission(principal: Principal, value: string, owner = false): boolean {
  return (!owner || principal.organizationRole === "owner") && workerStaffHasPermission(principal, value);
}
async function nango(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  if (!env.NANGO_API_KEY?.trim()) throw new Error("nango_not_configured");
  return (env.fetch ?? fetch)(`https://api.nango.dev${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.NANGO_API_KEY}`, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
}
async function payload(response: Response): Promise<Record<string, unknown>> {
  return await response.json().catch(() => ({})) as Record<string, unknown>;
}
function connections(value: Record<string, unknown>): NangoConnection[] {
  return Array.isArray(value.connections) ? value.connections as NangoConnection[] : [];
}
function ownerMatches(row: NangoConnection, principal: Principal): boolean {
  return row.tags?.end_user_id === principal.email && row.tags?.organization_id === principal.organizationId;
}
function providerError(row: NangoConnection): string | null {
  if (!Array.isArray(row.errors) || !row.errors.length) return null;
  const error = validRecord(row.errors[0]);
  const message = error?.message ?? error?.type ?? error?.error;
  return typeof message === "string" ? message : "Provider authorization needs attention";
}
function label(id: string): string {
  const lower = id.toLowerCase();
  if (lower.includes("paypal")) return lower.includes("sandbox") ? "PayPal Sandbox" : "PayPal";
  if (lower.includes("stripe")) return lower.includes("sandbox") ? "Stripe Sandbox" : "Stripe";
  if (lower.includes("xendit")) return lower.includes("sandbox") ? "Xendit Test" : "Xendit";
  return id;
}
async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function handleNangoAdminRequest(request: Request, database: WorkerDatabaseClient, env: Env, kind: "payment" | "crm"): Promise<Response> {
  const principal = await resolveWorkerStaffPrincipal(request, database, env);
  if (principal instanceof Response) return principal;
  const path = new URL(request.url).pathname;
  const isPayment = kind === "payment";
  if (request.method === "GET") {
    if (!permission(principal, isPayment ? "settings:read" : "crm:read")) return json({ error: "forbidden" }, 403);
    const integrations = configured(env, kind);
    try {
      const query = new URLSearchParams({ "tags[end_user_id]": principal.email, "tags[organization_id]": principal.organizationId, limit: "100" });
      const response = await nango(env, `/connections?${query}`);
      if (!response.ok) return json({ error: "provider_connections_unavailable" }, 502);
      const rows = connections(await payload(response)).filter((row) => typeof row.connection_id === "string" && typeof row.provider_config_key === "string" && integrations.includes(row.provider_config_key) && ownerMatches(row, principal));
      return json({ data: rows.map((row) => ({
        provider_config_key: row.provider_config_key,
        nango_connection_id: row.connection_id,
        provider: typeof row.provider === "string" ? row.provider : null,
        active: !providerError(row),
        status: providerError(row) ? "needs_attention" : "connected",
        error: providerError(row),
        updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
      })), integrations: integrations.map((id) => ({ id, label: label(id) })) });
    } catch (error) {
      return json({ error: error instanceof Error && error.message === "nango_not_configured" ? "NANGO_NOT_CONFIGURED" : "provider_connections_unavailable" }, 503);
    }
  }
  if (!(["POST", "DELETE"].includes(request.method))) return json({ error: "method_not_allowed" }, 405);
  if (!permission(principal, isPayment ? "settings:write" : "crm:write", true)) return json({ error: "organization_owner_required" }, 403);
  const rawBody = await request.text();
  if (rawBody.length > 16 * 1024) return json({ error: "payload_too_large" }, 413);
  let input: Record<string, unknown> | null;
  try { input = validRecord(JSON.parse(rawBody)); } catch { input = null; }
  if (!input) return json({ error: "invalid_request_body" }, 400);
  const allowedFields = new Set(["integration_id", "provider_config_key", "connection_id", "nango_connection_id"]);
  if (Object.keys(input).some((key) => !allowedFields.has(key))) return json({ error: "unknown_request_field" }, 400);
  const integration = bounded(input.integration_id ?? input.provider_config_key, 100);
  const connectionId = bounded(input.connection_id ?? input.nango_connection_id, 200);
  const isReconnect = isPayment && path.endsWith("/connections/reconnect");
  if ((request.method === "DELETE" || isReconnect) && !connectionId) return json({ error: "connection_id_required" }, 400);
  if (path.endsWith("/connect-session") && connectionId) return json({ error: "connection_id_not_allowed" }, 400);
  if (!integration || !configured(env, kind).includes(integration)) return json({ error: "integration_not_configured" }, 400);
  if (integration === "stripe" && (env.UVS_MERCHANT_COUNTRY ?? "PH").toUpperCase() !== "US") return json({ error: "STRIPE_UNAVAILABLE_IN_MERCHANT_COUNTRY" }, 409);
  const clientKey = request.headers.get("Idempotency-Key")?.trim();
  if (!clientKey || clientKey.length < 8 || clientKey.length > 200) return json({ error: "invalid_idempotency_key" }, 400);
  const idempotencyKey = `nango:${await digest(`${kind}\n${principal.organizationId}\n${principal.userId}\n${clientKey}`)}`;
  const requestHash = await digest(`${kind}\n${principal.organizationId}\n${principal.userId}\n${request.method}\n${path}\n${rawBody}`);
  const result = await executeIdempotently(new HyperdriveIdempotencyStore(database, 60), idempotencyKey, requestHash, async () => {
    try {
    if (request.method === "POST" && !connectionId) {
      const response = await nango(env, "/connect/sessions", { method: "POST", body: JSON.stringify({
        allowed_integrations: [integration],
        end_user: { id: principal.email, email: principal.email },
        organization: { id: principal.organizationId },
        tags: { end_user_id: principal.email, end_user_email: principal.email, organization_id: principal.organizationId },
      }) });
      const result = await payload(response);
      const data = validRecord(result.data);
      const token = data?.token ?? result.token;
      return response.ok && typeof token === "string" ? json({ data: { session_token: token } }) : json({ error: "connect_session_creation_failed" }, 502);
    }
    if (!connectionId) return json({ error: "connection_id_required" }, 400);
    const endpoint = `/connections/${encodeURIComponent(connectionId)}?provider_config_key=${encodeURIComponent(integration)}`;
    if (request.method === "DELETE") {
      const current = await nango(env, endpoint);
      if (!current.ok) return json({ error: "provider_connection_verification_failed" }, 502);
      const remotePayload = await payload(current);
      const remote = validRecord(remotePayload.data) as NangoConnection | null;
      if (!remote || !ownerMatches(remote, principal)) return json({ error: "provider_connection_owner_mismatch" }, 409);
      const removed = await nango(env, endpoint, { method: "DELETE" });
      if (!removed.ok && removed.status !== 404) return json({ error: "provider_disconnect_failed" }, 502);
      if (isPayment) {
        await database.query(
          "UPDATE public.payment_nango_connections SET active = false, updated_at = now() WHERE organization_id = $1 AND merchant_identity = $2 AND provider_config_key = $3 AND nango_connection_id = $4",
          [principal.organizationId, principal.email, integration, connectionId],
        );
      } else {
        await database.query(
          "UPDATE public.crm_nango_connections SET active = false, updated_at = now() WHERE organization_id = $1 AND staff_email = $2 AND provider_config_key = $3 AND connection_id = $4",
          [principal.organizationId, principal.email, integration, connectionId],
        );
      }
      return json({ data: { disconnected: true } });
    }
    const response = await nango(env, endpoint);
    if (!response.ok) return json({ error: "provider_connection_verification_failed" }, 502);
    const result = await payload(response);
    const remote = validRecord(result.data) as NangoConnection | null;
    if (!remote || remote.connection_id !== connectionId || remote.provider_config_key !== integration || !ownerMatches(remote, principal)) return json({ error: "provider_connection_owner_mismatch" }, 409);
    if (isReconnect) {
      const reconnect = await nango(env, "/connect/sessions/reconnect", {
        method: "POST",
        body: JSON.stringify({ connection_id: connectionId, integration_id: integration }),
      });
      const reconnectPayload = await payload(reconnect);
      const reconnectData = validRecord(reconnectPayload.data);
      const token = reconnectData?.token ?? reconnectPayload.token;
      return reconnect.ok && typeof token === "string"
        ? json({ data: { session_token: token } })
        : json({ error: "reconnect_session_creation_failed" }, 502);
    }
    if (isPayment) {
      await database.query(
        `INSERT INTO public.payment_nango_connections(provider_config_key, nango_connection_id, merchant_identity, organization_id, provider, metadata, active, updated_at)
         VALUES ($1, $2, $3, $4, $5, '{}'::jsonb, true, now())
         ON CONFLICT (provider_config_key, merchant_identity) DO UPDATE SET nango_connection_id = EXCLUDED.nango_connection_id, organization_id = EXCLUDED.organization_id, provider = EXCLUDED.provider, active = true, updated_at = now()`,
        [integration, connectionId, principal.email, principal.organizationId, typeof remote.provider === "string" ? remote.provider : null],
      );
    } else {
      await database.query(
        `INSERT INTO public.crm_nango_connections(provider, provider_config_key, connection_id, organization_id, staff_email, active, tags, metadata, updated_at)
         VALUES ('nango', $1, $2, $3, $4, true, $5::jsonb, '{}'::jsonb, now())
         ON CONFLICT (provider, provider_config_key, connection_id) DO UPDATE SET organization_id = EXCLUDED.organization_id, staff_email = EXCLUDED.staff_email, active = true, tags = EXCLUDED.tags, updated_at = now()`,
        [integration, connectionId, principal.organizationId, principal.email, JSON.stringify({ end_user_id: principal.email, organization_id: principal.organizationId })],
      );
    }
    return json({ data: { provider_config_key: integration, nango_connection_id: connectionId, active: true, status: "connected" } }, 201);
    } catch (error) {
      const missing = error instanceof Error && error.message === "nango_not_configured";
      return json({ error: missing ? "NANGO_NOT_CONFIGURED" : "provider_connection_operation_failed" }, missing ? 503 : 502);
    }
  });
  return result.response;
}
