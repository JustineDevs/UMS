import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  buildNangoCrmConnectionMetadata,
  buildNangoCrmConnectionTags,
  buildNangoCrmRecordMetadata,
  listCrmIntegrationConnections,
  listCrmIntegrationMappings,
  listCrmIntegrationRecords,
  NANGO_CRM_SUPPORTED_APPS,
  upsertCrmIntegrationConnection,
  upsertCrmIntegrationMapping,
  upsertCrmIntegrationRecord,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { parseBoundedJson } from "@/lib/bounded-request-body";

function cleanText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "crm:read")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }

  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });

  const [connections, mappings] = await Promise.all([
    listCrmIntegrationConnections(sup.client, { limit: 25, organizationId: organization.id }),
    listCrmIntegrationMappings(sup.client, { limit: 25, organizationId: organization.id }),
  ]);
  const recordGroups = await Promise.all(
    connections.map((connection) =>
      listCrmIntegrationRecords(sup.client, {
        connectionId: connection.connection_id,
        limit: 25,
      }),
    ),
  );
  const records = recordGroups.flat().slice(0, 25);

  return correlatedJson(cid, {
    data: {
      connections,
      mappings,
      records,
      supportedApps: NANGO_CRM_SUPPORTED_APPS.map((app) => ({
        provider_config_key: app.provider_config_key,
        label: app.label,
        category: app.category,
      })),
      summary: {
        connections: connections.length,
        mappings: mappings.length,
        records: records.length,
      },
    },
  });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "crm:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }

  const body = await parseBoundedJson(req, 256 * 1024);
  if (body.tooLarge) return correlatedJson(cid, { error: "Payload too large" }, { status: 413 });
  const rec = body.valid && body.value && typeof body.value === "object" && !Array.isArray(body.value)
    ? body.value as Record<string, unknown>
    : {};
  const kind = cleanText(rec.kind);
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const organization = await resolveStaffOrganization(sb, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const organizationId = organization.id;
  const actorEmail = session.user.email?.trim().toLowerCase() ?? null;

  async function organizationConnectionExists(
    providerConfigKey: string,
    connectionId: string,
  ) {
    const { data, error } = await sb
      .from("crm_nango_connections")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("provider_config_key", providerConfigKey)
      .eq("connection_id", connectionId)
      .eq("active", true)
      .maybeSingle();
    return !error && Boolean(data);
  }

  if (kind === "connection") {
    const providerConfigKey = cleanText(rec.provider_config_key);
    const connectionId = cleanText(rec.connection_id);
    const requestedOrganizationId = organizationId;
    if (!providerConfigKey || !connectionId) {
      return correlatedJson(
        cid,
        { error: "provider_config_key and connection_id are required" },
        { status: 400 },
      );
    }

    const tags = buildNangoCrmConnectionTags({
      endUserId: cleanText(rec.staff_user_id) ?? connectionId,
      endUserEmail: cleanText(rec.staff_email) ?? actorEmail ?? "",
      organizationId: requestedOrganizationId,
      branchId: cleanText(rec.branch_id),
      staffUserId: cleanText(rec.staff_user_id),
      staffEmail: cleanText(rec.staff_email) ?? actorEmail ?? undefined,
    });
    const metadata = buildNangoCrmConnectionMetadata({
      providerConfigKey,
      organizationId,
      syncScope: cleanText(rec.sync_scope) as "global" | "organization" | "branch" | "customer" | undefined,
      branchId: cleanText(rec.branch_id),
      workspaceId: cleanText(rec.workspace_id),
      staffUserId: cleanText(rec.staff_user_id),
      staffEmail: cleanText(rec.staff_email) ?? actorEmail ?? undefined,
      enabledEntities:
        Array.isArray(rec.enabled_entities) &&
        rec.enabled_entities.every((v) => v === "contact" || v === "deal")
          ? (rec.enabled_entities as Array<"contact" | "deal">)
          : undefined,
      source: "admin-bridge",
      branchLabel: cleanText(rec.branch_label),
      accountLabel: cleanText(rec.connection_name),
    });

    const row = await upsertCrmIntegrationConnection(sb, {
      provider_config_key: providerConfigKey,
      connection_id: connectionId,
      connection_name: cleanText(rec.connection_name),
      organization_id: organizationId,
      branch_id: cleanText(rec.branch_id),
      staff_user_id: cleanText(rec.staff_user_id),
      staff_email: cleanText(rec.staff_email) ?? actorEmail,
      sync_scope: cleanText(rec.sync_scope) as "global" | "organization" | "branch" | "customer" | undefined,
      active: rec.active == null ? true : Boolean(rec.active),
      tags,
      metadata: {
        ...metadata,
        source: "admin-bridge",
        operator_note: "Account linked from the admin bridge console",
      },
    });

    return correlatedJson(cid, { data: row }, { status: 201 });
  }

  if (kind === "record") {
    const providerConfigKey = cleanText(rec.provider_config_key);
    const connectionId = cleanText(rec.connection_id);
    const localEntityType = rec.local_entity_type === "deal" ? "deal" : rec.local_entity_type === "contact" ? "contact" : null;
    const localRecordId = cleanText(rec.local_record_id);
    if (!providerConfigKey || !connectionId || !localEntityType || !localRecordId) {
      return correlatedJson(
        cid,
        { error: "provider_config_key, connection_id, local_entity_type, and local_record_id are required" },
        { status: 400 },
      );
    }
    if (!(await organizationConnectionExists(providerConfigKey, connectionId))) {
      return correlatedJson(cid, { error: "CRM connection is not available for this organization" }, { status: 403 });
    }

    const row = await upsertCrmIntegrationRecord(sb, {
      provider_config_key: providerConfigKey,
      connection_id: connectionId,
      local_entity_type: localEntityType,
      local_record_id: localRecordId,
      local_record_label: cleanText(rec.local_record_label),
      external_entity_type:
        rec.external_entity_type === "deal" ? "deal" : rec.external_entity_type === "contact" ? "contact" : undefined,
      external_record_id: cleanText(rec.external_record_id),
      external_account_id: cleanText(rec.external_account_id),
      sync_scope: cleanText(rec.sync_scope) as "global" | "organization" | "branch" | "customer" | undefined,
      sync_state: cleanText(rec.sync_state) as
        | "pending"
        | "synced"
        | "partial"
        | "failed"
        | "manual_only"
        | "disabled"
        | "stale"
        | undefined,
      sync_mode: cleanText(rec.sync_mode) as "automatic" | "manual" | "disabled" | undefined,
      metadata: buildNangoCrmRecordMetadata({
        providerConfigKey,
        connectionId,
        localEntityType,
        localRecordId,
        localRecordLabel: cleanText(rec.local_record_label),
        externalEntityType:
          rec.external_entity_type === "deal"
            ? "deal"
            : rec.external_entity_type === "contact"
              ? "contact"
              : undefined,
        externalRecordId: cleanText(rec.external_record_id),
        externalAccountId: cleanText(rec.external_account_id),
        syncScope: cleanText(rec.sync_scope) as "global" | "organization" | "branch" | "customer" | undefined,
        syncState: cleanText(rec.sync_state) as
          | "pending"
          | "synced"
          | "partial"
          | "failed"
          | "manual_only"
          | "disabled"
          | "stale"
          | undefined,
        syncMode: cleanText(rec.sync_mode) as "automatic" | "manual" | "disabled" | undefined,
        lastDirection:
          rec.last_direction === "to_crm" || rec.last_direction === "from_crm" || rec.last_direction === "bidirectional"
            ? rec.last_direction
            : undefined,
        staffEmail: actorEmail,
        source: "admin-bridge",
      }),
      last_direction:
        rec.last_direction === "to_crm" || rec.last_direction === "from_crm" || rec.last_direction === "bidirectional"
          ? rec.last_direction
          : undefined,
      created_by_email: actorEmail,
      updated_by_email: actorEmail,
    });

    return correlatedJson(cid, { data: row }, { status: 201 });
  }

  if (kind === "mapping") {
    const customerEmail = cleanText(rec.customer_email);
    const mappingConnectionId = cleanText(rec.connection_id);
    const mappingProviderConfigKey = cleanText(rec.provider_config_key);
    if (!customerEmail) {
      return correlatedJson(cid, { error: "customer_email is required" }, { status: 400 });
    }
    if (mappingConnectionId && mappingProviderConfigKey && !(await organizationConnectionExists(mappingProviderConfigKey, mappingConnectionId))) {
      return correlatedJson(cid, { error: "CRM connection is not available for this organization" }, { status: 403 });
    }

    const row = await upsertCrmIntegrationMapping(sb, {
      organization_id: organizationId,
      customer_email: customerEmail,
      medusa_customer_id: cleanText(rec.medusa_customer_id),
      provider: "nango",
      connection_id: cleanText(rec.connection_id),
      external_contact_id: cleanText(rec.external_contact_id),
      external_account_id: cleanText(rec.external_account_id),
      sync_state: cleanText(rec.sync_state) as
        | "pending"
        | "synced"
        | "partial"
        | "failed"
        | "manual_only"
        | "disabled"
        | "stale"
        | undefined,
      sync_mode: cleanText(rec.sync_mode) as "automatic" | "manual" | "disabled" | undefined,
      metadata: {
        source: "admin-bridge",
        customer_name: cleanText(rec.customer_name),
        notes: cleanText(rec.notes),
      },
      created_by_email: actorEmail,
      updated_by_email: actorEmail,
    });

    return correlatedJson(cid, { data: row }, { status: 201 });
  }

  return correlatedJson(cid, { error: "kind must be connection, record, or mapping" }, { status: 400 });
}

export const POST = withAdminMutationIdempotency("/admin/crm/bridge:POST", post);
