import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { z } from "zod";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { parseAdminJson } from "@/lib/admin-api-security";
import { resolveStaffOrganization, organizationCanManageCrmConnections } from "@/lib/staff-organization";
import { configuredCrmIntegrations, nangoCrmErrorMessage, type CrmNangoConnection } from "@/lib/crm-nango";
import { buildNangoCrmConnectionMetadata, buildNangoCrmConnectionTags, upsertCrmIntegrationConnection } from "@universal-music-store/platform-data";

export const dynamic = "force-dynamic";
const saveSchema = z.object({ provider_config_key: z.string().trim().min(1).max(100), connection_id: z.string().trim().min(1).max(200) }).strict();
const disconnectSchema = z.object({ provider_config_key: z.string().trim().min(1).max(100), nango_connection_id: z.string().trim().min(1).max(200) }).strict();

async function organizationContext(cid: string, permission: "crm:read" | "crm:write") {
  const staff = await requireStaffApiSession(permission);
  if (!staff.ok) return { response: staff.response } as const;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return { response: sup.response } as const;
  const organization = await resolveStaffOrganization(sup.client, staff.session.user?.email);
  if (!organization) return { response: correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 }) } as const;
  return { staff, sup, organization } as const;
}

async function get(request: Request) {
  const cid = getCorrelationId(request);
  const context = await organizationContext(cid, "crm:read");
  if ("response" in context) return context.response;
  const configured = configuredCrmIntegrations();
  const apiKey = process.env.NANGO_API_KEY?.trim();
  const identity = context.staff.session.user?.email?.trim().toLowerCase() ?? "";
  if (!apiKey) return correlatedJson(cid, { data: [], integrations: configured, source: "nango-not-configured" });
  const query = new URLSearchParams({ "tags[end_user_id]": identity, "tags[organization_id]": context.organization.id, limit: "100" });
  const response = await fetch(`https://api.nango.dev/connections?${query}`, { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return correlatedJson(cid, { error: "Nango connection status unavailable" }, { status: 502 });
  const allowed = new Set(configured.map((item) => item.id));
  const data: CrmNangoConnection[] = (payload.connections ?? [])
    .filter((row: Record<string, unknown>) => {
      const tags = row.tags as Record<string, unknown> | undefined;
      return allowed.has(String(row.provider_config_key)) && tags?.organization_id === context.organization.id;
    })
    .map((row: Record<string, unknown>) => ({
      provider_config_key: String(row.provider_config_key),
      nango_connection_id: String(row.connection_id),
      provider: typeof row.provider === "string" ? row.provider : null,
      active: true,
      status: nangoCrmErrorMessage(row.errors) ? "needs_attention" : "connected",
      error: nangoCrmErrorMessage(row.errors),
      updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
    }));
  return correlatedJson(cid, { data, integrations: configured, source: "nango" });
}

async function post(request: Request) {
  const cid = getCorrelationId(request);
  const context = await organizationContext(cid, "crm:write");
  if ("response" in context) return context.response;
  if (!organizationCanManageCrmConnections(context.organization.role)) return correlatedJson(cid, { error: "Only the organization owner can manage CRM connections" }, { status: 403 });
  const parsed = await parseAdminJson(request, saveSchema);
  if (!parsed.ok) return correlatedJson(cid, { error: parsed.error }, { status: parsed.status });
  const { provider_config_key: providerConfigKey, connection_id: connectionId } = parsed.data;
  if (!configuredCrmIntegrations().some((item) => item.id === providerConfigKey)) return correlatedJson(cid, { error: "CRM integration is not configured for this server" }, { status: 400 });
  const apiKey = process.env.NANGO_API_KEY?.trim();
  if (!apiKey) return correlatedJson(cid, { error: "Nango is not configured", code: "NANGO_NOT_CONFIGURED" }, { status: 503 });
  const verification = await fetch(`https://api.nango.dev/connections/${encodeURIComponent(connectionId)}?provider_config_key=${encodeURIComponent(providerConfigKey)}`, { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
  const remotePayload = await verification.json().catch(() => ({})) as Record<string, unknown> & { data?: Record<string, unknown> };
  if (!verification.ok || String((remotePayload.data ?? remotePayload).connection_id ?? connectionId) !== connectionId) return correlatedJson(cid, { error: "CRM provider connection could not be verified" }, { status: 409 });
  const actorEmail = context.staff.session.user?.email?.trim().toLowerCase() ?? null;
  const row = await upsertCrmIntegrationConnection(context.sup.client, {
    provider_config_key: providerConfigKey,
    connection_id: connectionId,
    connection_name: null,
    organization_id: context.organization.id,
    staff_email: actorEmail,
    active: true,
    metadata: { ...(buildNangoCrmConnectionMetadata({ providerConfigKey, organizationId: context.organization.id, syncScope: "organization", staffEmail: actorEmail ?? undefined, source: "nango-connect" })), provider: (remotePayload.data ?? remotePayload).provider ?? null },
    sync_scope: "organization",
    tags: buildNangoCrmConnectionTags({ endUserId: actorEmail ?? connectionId, endUserEmail: actorEmail ?? "", organizationId: context.organization.id, staffEmail: actorEmail ?? undefined }),
  });
  return correlatedJson(cid, { data: row }, { status: 201 });
}

async function del(request: Request) {
  const cid = getCorrelationId(request);
  const context = await organizationContext(cid, "crm:write");
  if ("response" in context) return context.response;
  if (!organizationCanManageCrmConnections(context.organization.role)) return correlatedJson(cid, { error: "Only the organization owner can manage CRM connections" }, { status: 403 });
  const parsed = await parseAdminJson(request, disconnectSchema);
  if (!parsed.ok) return correlatedJson(cid, { error: parsed.error }, { status: parsed.status });
  const { provider_config_key: providerConfigKey, nango_connection_id: connectionId } = parsed.data;
  const apiKey = process.env.NANGO_API_KEY?.trim();
  if (!apiKey) return correlatedJson(cid, { error: "Nango is not configured", code: "NANGO_NOT_CONFIGURED" }, { status: 503 });
  if (!configuredCrmIntegrations().some((item) => item.id === providerConfigKey)) return correlatedJson(cid, { error: "CRM integration is not configured for this server" }, { status: 400 });
  const remote = await fetch(`https://api.nango.dev/connections/${encodeURIComponent(connectionId)}?provider_config_key=${encodeURIComponent(providerConfigKey)}`, { method: "DELETE", headers: { Authorization: `Bearer ${apiKey}` } });
  if (!remote.ok && remote.status !== 404) return correlatedJson(cid, { error: "Unable to disconnect CRM provider" }, { status: 502 });
  const { error } = await context.sup.client.from("crm_nango_connections").update({ active: false }).eq("organization_id", context.organization.id).eq("provider_config_key", providerConfigKey).eq("connection_id", connectionId);
  if (error) return correlatedJson(cid, { error: "Unable to disconnect CRM provider" }, { status: 502 });
  return correlatedJson(cid, { data: { disconnected: true } });
}

export const GET = get;
export const POST = withAdminMutationIdempotency("/admin/crm/nango:POST", post);
export const DELETE = withAdminMutationIdempotency("/admin/crm/nango:DELETE", del);
