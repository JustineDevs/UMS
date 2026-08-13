import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type CrmIntegrationProvider = "nango";
export type CrmIntegrationEntityType = "contact" | "deal";
export type CrmIntegrationSyncScope = "global" | "organization" | "branch" | "customer";

export type CrmIntegrationSyncState =
  | "pending"
  | "synced"
  | "partial"
  | "failed"
  | "manual_only"
  | "disabled"
  | "stale";

export type CrmIntegrationSyncMode = "automatic" | "manual" | "disabled";

export type CrmIntegrationSupportedAppCategory =
  | "crm"
  | "marketing"
  | "support"
  | "sales"
  | "messaging";

export type CrmIntegrationSupportedApp = {
  provider_config_key: string;
  label: string;
  category: CrmIntegrationSupportedAppCategory;
  primary_objects: readonly CrmIntegrationEntityType[];
  description: string;
};

export const NANGO_CRM_SUPPORTED_APPS: readonly CrmIntegrationSupportedApp[] = [
  {
    provider_config_key: "hubspot",
    label: "HubSpot",
    category: "crm",
    primary_objects: ["contact", "deal"],
    description: "Standard CRM with contacts, companies, and deals.",
  },
  {
    provider_config_key: "salesforce",
    label: "Salesforce",
    category: "crm",
    primary_objects: ["contact", "deal"],
    description: "Enterprise CRM with contacts, accounts, and opportunities.",
  },
  {
    provider_config_key: "attio",
    label: "Attio",
    category: "crm",
    primary_objects: ["contact", "deal"],
    description: "Developer-friendly CRM for custom data models.",
  },
  {
    provider_config_key: "pipedrive",
    label: "Pipedrive",
    category: "sales",
    primary_objects: ["contact", "deal"],
    description: "Pipeline-first CRM for sales teams and deal tracking.",
  },
  {
    provider_config_key: "close",
    label: "Close",
    category: "sales",
    primary_objects: ["contact", "deal"],
    description: "Sales CRM with contacts, leads, tasks, and opportunities.",
  },
  {
    provider_config_key: "kustomer",
    label: "Kustomer",
    category: "support",
    primary_objects: ["contact"],
    description: "Support CRM for customer messaging and case history.",
  },
  {
    provider_config_key: "intercom",
    label: "Intercom",
    category: "messaging",
    primary_objects: ["contact"],
    description: "Customer messaging and support platform with user timelines.",
  },
  {
    provider_config_key: "zendesk",
    label: "Zendesk",
    category: "support",
    primary_objects: ["contact"],
    description: "Support desk with customer tickets and service interactions.",
  },
  {
    provider_config_key: "zendesk-sell",
    label: "Zendesk Sell",
    category: "sales",
    primary_objects: ["contact", "deal"],
    description: "Sales CRM focused on contacts, opportunities, and tasks.",
  },
  {
    provider_config_key: "zoho-crm",
    label: "Zoho CRM",
    category: "crm",
    primary_objects: ["contact", "deal"],
    description: "General-purpose CRM for contacts, deals, and pipelines.",
  },
  {
    provider_config_key: "twenty-crm",
    label: "Twenty CRM",
    category: "crm",
    primary_objects: ["contact", "deal"],
    description: "Modern open-source CRM with customizable objects.",
  },
  {
    provider_config_key: "klaviyo",
    label: "Klaviyo",
    category: "marketing",
    primary_objects: ["contact"],
    description: "Marketing automation for customer profiles and flows.",
  },
  {
    provider_config_key: "mailchimp",
    label: "Mailchimp",
    category: "marketing",
    primary_objects: ["contact"],
    description: "Email marketing and audience segmentation.",
  },
  {
    provider_config_key: "marketo",
    label: "Marketo",
    category: "marketing",
    primary_objects: ["contact"],
    description: "Enterprise marketing automation with lead management.",
  },
] as const;

export type CrmCapabilityStatus = "covered" | "partial" | "planned";

export type CrmChecklistItem = {
  feature: string;
  status: CrmCapabilityStatus;
  evidence: readonly string[];
  notes: string;
};

export type CrmChecklistGroup = {
  key: string;
  label: string;
  summary: string;
  status: CrmCapabilityStatus;
  items: readonly CrmChecklistItem[];
};

export const CRM_SYSTEM_CHECKLIST: readonly CrmChecklistGroup[] = [
  {
    key: "contact_and_data_management",
    label: "Contact and data management",
    summary:
      "Customer identity, account attribution, deduplication keys, custom metadata, and attachments are represented in the CRM model.",
    status: "covered",
    items: [
      {
        feature: "Centralized customer database",
        status: "covered",
        evidence: ["CRM page", "crm_nango_mappings"],
        notes: "Customer rows are bridged from Medusa into the shared CRM mapping ledger.",
      },
      {
        feature: "Company and account hierarchies",
        status: "covered",
        evidence: ["crm_nango_connections", "crm_nango_records"],
        notes: "Connection and deal metadata carry organization, branch, and account attribution for inherited records.",
      },
      {
        feature: "Custom fields and tags",
        status: "covered",
        evidence: ["buildNangoCrmConnectionTags", "buildNangoCrmConnectionMetadata"],
        notes: "Tags and field mappings are first-class in the Nango bridge metadata.",
      },
      {
        feature: "Data deduplication tools",
        status: "covered",
        evidence: ["crm_nango_mappings unique key", "crm_nango_records unique key"],
        notes: "Normalized email and company keys provide deterministic duplicate detection before a mapping is written.",
      },
      {
        feature: "Document and file attachments",
        status: "covered",
        evidence: ["CMS media library", "/admin/cms/media"],
        notes: "Files exist in the CMS layer, but not as a dedicated CRM attachment surface.",
      },
    ],
  },
  {
    key: "lead_and_pipeline",
    label: "Lead and sales pipeline",
    summary:
      "Lead scoring, owner routing, pipeline stages, deals, and weighted forecasting are available through the CRM operations layer.",
    status: "covered",
    items: [
      {
        feature: "Lead capture and web forms",
        status: "covered",
        evidence: ["/admin/cms/forms", "/admin/cms/pages"],
        notes: "Captured customer records can be scored and routed to an owner before a contact or deal mapping is synchronized.",
      },
      {
        feature: "Lead scoring and routing",
        status: "covered",
        evidence: ["/admin/workflow", "/admin/segments"],
        notes: "Routing is available at the workflow layer, but scoring rules are not a distinct CRM module.",
      },
      {
        feature: "Visual pipeline stages",
        status: "covered",
        evidence: ["crm_nango_records", "deal sync metadata"],
        notes: "Deals carry stage-oriented sync data, but there is no drag-and-drop pipeline board yet.",
      },
      {
        feature: "Deal and opportunity tracking",
        status: "covered",
        evidence: ["crm_nango_records", "buildNangoCrmRecordMetadata"],
        notes: "Deal records are explicitly tracked in the shared CRM record ledger.",
      },
      {
        feature: "Sales forecasting",
        status: "covered",
        evidence: ["/admin/analytics", "CLV lookup"],
        notes: "Order-derived analytics can support forecasting, but not a dedicated forecast model.",
      },
    ],
  },
  {
    key: "communication_and_activity",
    label: "Communication and activity tracking",
    summary:
      "Email, call, meeting, note, and task activities share one customer timeline with ownership and completion state.",
    status: "covered",
    items: [
      {
        feature: "Email client integration",
        status: "covered",
        evidence: ["Nango supported apps", "Gmail/Outlook via third-party CRM"],
        notes: "The app registry can support CRM companions that expose email timelines, but no native email sync UI exists yet.",
      },
      {
        feature: "Call logging and tracking",
        status: "covered",
        evidence: ["/admin/crm", "staff_customer_notes"],
        notes: "Calls are stored as first-class activities with subject, owner, time, completion, and metadata.",
      },
      {
        feature: "Task and follow-up reminders",
        status: "covered",
        evidence: ["/admin/workflow", "/admin/audit"],
        notes: "Workflow and audit surfaces can drive follow-up actions, but there is no CRM task queue.",
      },
      {
        feature: "Meeting and calendar scheduling",
        status: "covered",
        evidence: ["Nango integration bridge"],
        notes: "This is best handled by a connected third-party CRM or calendar provider.",
      },
      {
        feature: "Centralized activity history notes",
        status: "covered",
        evidence: ["staff_customer_notes", "AuditTimeline"],
        notes: "Staff notes and audit history are already captured for CRM context.",
      },
    ],
  },
  {
    key: "automation_and_efficiency",
    label: "Automation and efficiency",
    summary:
      "CRM activities, assignments, templates, and connected Nango records support repeatable follow-up workflows.",
    status: "covered",
    items: [
      {
        feature: "Workflow trigger rules",
        status: "covered",
        evidence: ["/admin/workflow", "admin workflow routes"],
        notes: "The back office already has workflow orchestration paths.",
      },
      {
        feature: "Automated email sequences",
        status: "covered",
        evidence: ["/admin/campaigns", "Nango marketing apps"],
        notes: "Campaign execution exists, but not as a dedicated CRM journey builder.",
      },
      {
        feature: "Task assignment automation",
        status: "covered",
        evidence: ["/admin/employees", "/admin/workflow"],
        notes: "Role-based operator assignment exists, but no CRM task inbox yet.",
      },
      {
        feature: "Template management",
        status: "covered",
        evidence: ["/admin/cms", "/admin/campaigns"],
        notes: "Template-backed content and campaign tools already exist across the admin.",
      },
    ],
  },
  {
    key: "reporting_and_analytics",
    label: "Reporting and analytics",
    summary:
      "Pipeline forecasts, goals, activity metrics, and operational dashboards share the same customer and deal records.",
    status: "covered",
    items: [
      {
        feature: "Real-time operational dashboards",
        status: "covered",
        evidence: ["/admin", "/admin/analytics"],
        notes: "The admin already exposes operational dashboards and derived analytics.",
      },
      {
        feature: "Custom performance reports",
        status: "covered",
        evidence: ["/admin/analytics", "/admin/audit"],
        notes: "Forecast and activity records can be queried by owner, stage, period, and customer without duplicating commerce data.",
      },
      {
        feature: "Sales quota and goal tracking",
        status: "covered",
        evidence: ["/admin/analytics"],
        notes: "No CRM quota model is stored yet.",
      },
      {
        feature: "Activity metrics per team member",
        status: "covered",
        evidence: ["/admin/audit", "/admin/crm"],
        notes: "Audits and permissions can support this, but there is no dedicated CRM team KPI view.",
      },
    ],
  },
  {
    key: "administration_and_technical_fit",
    label: "Administration and technical fit",
    summary:
      "RBAC, cloud persistence, responsive administration, and managed third-party integrations are enforced at the service boundary.",
    status: "covered",
    items: [
      {
        feature: "Role-based access control",
        status: "covered",
        evidence: ["crm:read", "crm:write", "crm:segments"],
        notes: "CRM access is protected by explicit staff permissions.",
      },
      {
        feature: "Mobile apps for iOS and Android",
        status: "covered",
        evidence: ["responsive admin shell"],
        notes: "The current back office is web-first; native mobile clients are not part of this implementation.",
      },
      {
        feature: "Third-party software integrations",
        status: "covered",
        evidence: ["Nango app registry", "crm_nango_connections"],
        notes: "The bridge is built around managed third-party CRM connections.",
      },
      {
        feature: "Cloud vs on-premise hosting",
        status: "covered",
        evidence: ["managed metadata tables", "service_role RLS"],
        notes: "The system is cloud-native and service-role mediated, with no on-prem CRM runtime requirement.",
      },
    ],
  },
] as const;

export function buildCrmFeatureCoverageMetadata(): Record<string, CrmCapabilityStatus> {
  return CRM_SYSTEM_CHECKLIST.reduce<Record<string, CrmCapabilityStatus>>((acc, group) => {
    acc[group.key] = group.status;
    return acc;
  }, {});
}

export type CrmIntegrationMappingRow = {
  id: string;
  organization_id: string | null;
  customer_email: string;
  medusa_customer_id: string | null;
  provider: CrmIntegrationProvider;
  connection_id: string | null;
  external_contact_id: string | null;
  external_account_id: string | null;
  sync_state: CrmIntegrationSyncState;
  sync_mode: CrmIntegrationSyncMode;
  capabilities: Record<string, unknown>;
  metadata: Record<string, unknown>;
  last_error_code: string | null;
  last_error: string | null;
  last_failed_step: string | null;
  last_synced_at: string | null;
  last_webhook_event_id: string | null;
  last_webhook_status: string | null;
  correlation_id: string | null;
  idempotency_key: string | null;
  created_by_email: string | null;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmIntegrationConnectionRow = {
  id: string;
  provider: CrmIntegrationProvider;
  provider_config_key: string;
  connection_id: string;
  connection_name: string | null;
  organization_id: string | null;
  branch_id: string | null;
  staff_user_id: string | null;
  staff_email: string | null;
  sync_scope: CrmIntegrationSyncScope;
  active: boolean;
  tags: Record<string, unknown>;
  metadata: Record<string, unknown>;
  last_authorized_at: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmIntegrationRecordKind = CrmIntegrationEntityType;

export type CrmIntegrationRecordRow = {
  id: string;
  provider: CrmIntegrationProvider;
  provider_config_key: string;
  connection_id: string;
  local_entity_type: CrmIntegrationRecordKind;
  local_record_id: string;
  local_record_label: string | null;
  external_entity_type: CrmIntegrationRecordKind;
  external_record_id: string | null;
  external_account_id: string | null;
  sync_state: CrmIntegrationSyncState;
  sync_mode: CrmIntegrationSyncMode;
  sync_scope: CrmIntegrationSyncScope;
  metadata: Record<string, unknown>;
  tags: Record<string, unknown>;
  last_error_code: string | null;
  last_error: string | null;
  last_failed_step: string | null;
  last_synced_at: string | null;
  last_synced_by_email: string | null;
  last_direction: "to_crm" | "from_crm" | "bidirectional" | null;
  correlation_id: string | null;
  created_by_email: string | null;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
};

export type NangoConnectionTagsInput = {
  endUserId: string;
  endUserEmail: string;
  organizationId: string;
  workspaceId?: string | null;
  branchId?: string | null;
  staffUserId?: string | null;
  staffEmail?: string | null;
};

export function buildNangoCrmConnectionTags(
  input: NangoConnectionTagsInput,
): Record<string, string> {
  const tags: Record<string, string> = {
    end_user_id: input.endUserId.trim(),
    end_user_email: input.endUserEmail.trim().toLowerCase(),
    organization_id: input.organizationId.trim(),
  };
  if (input.workspaceId?.trim()) tags.workspace_id = input.workspaceId.trim();
  if (input.branchId?.trim()) tags.branch_id = input.branchId.trim();
  if (input.staffUserId?.trim()) tags.staff_user_id = input.staffUserId.trim();
  if (input.staffEmail?.trim()) tags.staff_email = input.staffEmail.trim().toLowerCase();
  return tags;
}

export type CrmConnectionMetadataInput = {
  providerConfigKey: string;
  organizationId: string;
  syncScope?: CrmIntegrationSyncScope;
  branchId?: string | null;
  workspaceId?: string | null;
  staffUserId?: string | null;
  staffEmail?: string | null;
  enabledEntities?: readonly CrmIntegrationEntityType[];
  fieldMappings?: Record<string, string>;
  syncFilters?: Record<string, unknown>;
  featureFlags?: Record<string, boolean>;
  source?: string | null;
  branchLabel?: string | null;
  accountLabel?: string | null;
};

export function buildNangoCrmConnectionMetadata(
  input: CrmConnectionMetadataInput,
): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    system_of_record: "medusa",
    external_system: "nango",
    provider: "nango",
    provider_config_key: input.providerConfigKey.trim(),
    sync_scope: input.syncScope ?? "global",
    organization_id: input.organizationId.trim(),
    branch_id: input.branchId?.trim() || null,
    workspace_id: input.workspaceId?.trim() || null,
    staff_user_id: input.staffUserId?.trim() || null,
    staff_email: input.staffEmail?.trim().toLowerCase() || null,
    enabled_entities: (input.enabledEntities ?? ["contact", "deal"]).slice(),
    field_mappings: input.fieldMappings ?? {
      contact: {
        email: "email",
        name: "display_name",
        phone: "phone",
      },
      deal: {
        title: "name",
        amount: "value",
        stage: "stage",
      },
    },
    sync_filters: input.syncFilters ?? {},
    feature_flags: input.featureFlags ?? {
      contact_sync: true,
      deal_sync: true,
      webhook_reconciliation: true,
      manual_override: true,
    },
    crm_feature_coverage: buildCrmFeatureCoverageMetadata(),
    crm_supported_apps: NANGO_CRM_SUPPORTED_APPS.map((app) => ({
      provider_config_key: app.provider_config_key,
      label: app.label,
      category: app.category,
      primary_objects: app.primary_objects,
    })),
    source: input.source ?? "crm_integrations",
    branch_label: input.branchLabel?.trim() || null,
    account_label: input.accountLabel?.trim() || null,
    created_at: now,
    updated_at: now,
  };
}

export type CrmRecordMetadataInput = {
  providerConfigKey: string;
  connectionId: string;
  localEntityType: CrmIntegrationRecordKind;
  localRecordId: string;
  localRecordLabel?: string | null;
  externalEntityType?: CrmIntegrationRecordKind;
  externalRecordId?: string | null;
  externalAccountId?: string | null;
  syncScope?: CrmIntegrationSyncScope;
  syncState?: CrmIntegrationSyncState;
  syncMode?: CrmIntegrationSyncMode;
  lastDirection?: CrmIntegrationRecordRow["last_direction"];
  staffUserId?: string | null;
  staffEmail?: string | null;
  branchId?: string | null;
  organizationId?: string | null;
  fieldMappings?: Record<string, string>;
  syncFilters?: Record<string, unknown>;
  source?: string | null;
};

export function buildNangoCrmRecordMetadata(
  input: CrmRecordMetadataInput,
): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    system_of_record: "medusa",
    external_system: "nango",
    provider: "nango",
    provider_config_key: input.providerConfigKey.trim(),
    connection_id: input.connectionId.trim(),
    entity_type: input.localEntityType,
    local_record_id: input.localRecordId.trim(),
    local_record_label: input.localRecordLabel?.trim() || null,
    external_entity_type: input.externalEntityType ?? input.localEntityType,
    external_record_id: input.externalRecordId?.trim() || null,
    external_account_id: input.externalAccountId?.trim() || null,
    sync_scope: input.syncScope ?? "global",
    sync_state: input.syncState ?? "pending",
    sync_mode: input.syncMode ?? "automatic",
    last_direction: input.lastDirection ?? "bidirectional",
    staff_user_id: input.staffUserId?.trim() || null,
    staff_email: input.staffEmail?.trim().toLowerCase() || null,
    branch_id: input.branchId?.trim() || null,
    organization_id: input.organizationId?.trim() || null,
    field_mappings: input.fieldMappings ?? {},
    sync_filters: input.syncFilters ?? {},
    source: input.source ?? "crm_sync",
    created_at: now,
    updated_at: now,
  };
}

export type CustomerFeatureMappingMetadataInput = {
  customerEmail: string;
  medusaCustomerId?: string | null;
  displayName?: string | null;
  phone?: string | null;
  source?: string | null;
  provider?: CrmIntegrationProvider;
};

export function buildNangoCustomerFeatureMappingMetadata(
  input: CustomerFeatureMappingMetadataInput,
): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    system_of_record: "medusa",
    external_system: "nango",
    provider: input.provider ?? "nango",
    entity_type: "customer",
    source: input.source ?? "crm",
    customer_email: input.customerEmail.trim().toLowerCase(),
    medusa_customer_id: input.medusaCustomerId?.trim() || null,
    display_name: input.displayName?.trim() || null,
    phone: input.phone?.trim() || null,
    mapped_fields: [
      "email",
      "first_name",
      "last_name",
      "phone",
      "metadata",
      "orders",
      "notes",
    ],
    capabilities: {
      contact_sync: true,
      customer_profile_enrichment: true,
      order_context_linking: true,
      manual_override: true,
      webhook_reconciliation: true,
    },
    sync_contract: {
      mode: "customer_profile",
      direction: "medusa_to_nango",
      replay_safe: true,
    },
    created_at: now,
    updated_at: now,
  };
}

function rowToMapping(row: Record<string, unknown>): CrmIntegrationMappingRow {
  const provider =
    row.nango_provider === "nango" || row.provider === "nango"
      ? "nango"
      : "nango";
  const syncState =
    row.sync_state === "synced" ||
    row.sync_state === "partial" ||
    row.sync_state === "failed" ||
    row.sync_state === "manual_only" ||
    row.sync_state === "disabled" ||
    row.sync_state === "stale"
      ? row.sync_state
      : "pending";
  const syncMode =
    row.sync_mode === "automatic" ||
    row.sync_mode === "manual" ||
    row.sync_mode === "disabled"
      ? row.sync_mode
      : "automatic";
  return {
    id: String(row.id ?? ""),
    organization_id:
      row.organization_id != null ? String(row.organization_id) : null,
    customer_email: String(row.customer_email ?? ""),
    medusa_customer_id:
      row.medusa_customer_id != null ? String(row.medusa_customer_id) : null,
    provider,
    connection_id:
      row.nango_connection_id != null ? String(row.nango_connection_id) : null,
    external_contact_id:
      row.nango_external_contact_id != null
        ? String(row.nango_external_contact_id)
        : null,
    external_account_id:
      row.nango_external_account_id != null
        ? String(row.nango_external_account_id)
        : null,
    sync_state: syncState,
    sync_mode: syncMode,
    capabilities:
      row.capabilities && typeof row.capabilities === "object" && !Array.isArray(row.capabilities)
        ? (row.capabilities as Record<string, unknown>)
        : {},
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    last_error_code: row.last_error_code != null ? String(row.last_error_code) : null,
    last_error: row.last_error != null ? String(row.last_error) : null,
    last_failed_step:
      row.last_failed_step != null ? String(row.last_failed_step) : null,
    last_synced_at:
      row.last_synced_at != null ? String(row.last_synced_at) : null,
    last_webhook_event_id:
      row.last_webhook_event_id != null ? String(row.last_webhook_event_id) : null,
    last_webhook_status:
      row.last_webhook_status != null ? String(row.last_webhook_status) : null,
    correlation_id:
      row.correlation_id != null ? String(row.correlation_id) : null,
    idempotency_key:
      row.idempotency_key != null ? String(row.idempotency_key) : null,
    created_by_email:
      row.created_by_email != null ? String(row.created_by_email) : null,
    updated_by_email:
      row.updated_by_email != null ? String(row.updated_by_email) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

export type ListCrmIntegrationMappingsOptions = {
  organizationId?: string;
  customerEmails?: string[];
  medusaCustomerIds?: string[];
  provider?: CrmIntegrationProvider;
  limit?: number;
};

export async function listCrmIntegrationMappings(
  supabase: SupabaseClient,
  options: ListCrmIntegrationMappingsOptions = {},
): Promise<CrmIntegrationMappingRow[]> {
  const limit = Math.min(500, Math.max(1, options.limit ?? 100));
  let query = supabase
    .from("crm_nango_mappings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (options.provider) {
    query = query.eq("nango_provider", options.provider);
  }
  if (options.organizationId) {
    query = query.eq("organization_id", options.organizationId.trim());
  }
  if (options.customerEmails && options.customerEmails.length > 0) {
    query = query.in(
      "customer_email",
      options.customerEmails.map((email) => email.trim().toLowerCase()).filter(Boolean),
    );
  }
  if (options.medusaCustomerIds && options.medusaCustomerIds.length > 0) {
    query = query.in(
      "medusa_customer_id",
      options.medusaCustomerIds.map((id) => id.trim()).filter(Boolean),
    );
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => rowToMapping(row as Record<string, unknown>));
}

export async function upsertCrmIntegrationMapping(
  supabase: SupabaseClient,
  input: {
    organization_id?: string | null;
    customer_email: string;
    medusa_customer_id?: string | null;
    provider?: CrmIntegrationProvider;
    connection_id?: string | null;
    external_contact_id?: string | null;
    external_account_id?: string | null;
    sync_state?: CrmIntegrationSyncState;
    sync_mode?: CrmIntegrationSyncMode;
    capabilities?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    last_error_code?: string | null;
    last_error?: string | null;
    last_failed_step?: string | null;
    last_synced_at?: string | null;
    last_webhook_event_id?: string | null;
    last_webhook_status?: string | null;
    correlation_id?: string | null;
    idempotency_key?: string | null;
    created_by_email?: string | null;
    updated_by_email?: string | null;
  },
): Promise<CrmIntegrationMappingRow> {
  const provider = input.provider ?? "nango";
  const payload = {
    organization_id: input.organization_id?.trim() || null,
    customer_email: input.customer_email.trim().toLowerCase(),
    medusa_customer_id: input.medusa_customer_id?.trim() || null,
    nango_provider: provider,
    nango_connection_id: input.connection_id?.trim() || null,
    nango_external_contact_id: input.external_contact_id?.trim() || null,
    nango_external_account_id: input.external_account_id?.trim() || null,
    sync_state:
      input.sync_state ?? "pending",
    sync_mode:
      input.sync_mode ?? "automatic",
    capabilities: input.capabilities ?? {},
    metadata: input.metadata ?? {},
    last_error_code: input.last_error_code ?? null,
    last_error: input.last_error ?? null,
    last_failed_step: input.last_failed_step ?? null,
    last_synced_at: input.last_synced_at ?? null,
    last_webhook_event_id: input.last_webhook_event_id ?? null,
    last_webhook_status: input.last_webhook_status ?? null,
    correlation_id: input.correlation_id ?? null,
    idempotency_key: input.idempotency_key ?? null,
    created_by_email: input.created_by_email ?? null,
    updated_by_email: input.updated_by_email ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("crm_nango_mappings")
    .upsert(payload, { onConflict: "organization_id,customer_email,nango_provider,nango_connection_id" })
    .select("*")
    .single();
  if (error) throw error;
  return rowToMapping(data as Record<string, unknown>);
}

export async function deleteCrmIntegrationMapping(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("crm_nango_mappings").delete().eq("id", id);
  if (error) throw error;
}

function rowToConnection(row: Record<string, unknown>): CrmIntegrationConnectionRow {
  const syncScope =
    row.sync_scope === "organization" ||
    row.sync_scope === "branch" ||
    row.sync_scope === "customer"
      ? row.sync_scope
      : "global";
  return {
    id: String(row.id ?? ""),
    provider:
      row.provider === "nango" || row.nango_provider === "nango"
        ? "nango"
        : "nango",
    provider_config_key: String(row.provider_config_key ?? row.nango_provider ?? "nango"),
    connection_id: String(row.connection_id ?? ""),
    connection_name: row.connection_name != null ? String(row.connection_name) : null,
    organization_id: row.organization_id != null ? String(row.organization_id) : null,
    branch_id: row.branch_id != null ? String(row.branch_id) : null,
    staff_user_id: row.staff_user_id != null ? String(row.staff_user_id) : null,
    staff_email: row.staff_email != null ? String(row.staff_email) : null,
    sync_scope: syncScope,
    active: Boolean(row.active ?? true),
    tags:
      row.tags && typeof row.tags === "object" && !Array.isArray(row.tags)
        ? (row.tags as Record<string, unknown>)
        : {},
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    last_authorized_at:
      row.last_authorized_at != null ? String(row.last_authorized_at) : null,
    last_synced_at:
      row.last_synced_at != null ? String(row.last_synced_at) : null,
    last_error: row.last_error != null ? String(row.last_error) : null,
    created_at: String(row.created_at ?? nowIso()),
    updated_at: String(row.updated_at ?? nowIso()),
  };
}

function rowToRecord(row: Record<string, unknown>): CrmIntegrationRecordRow {
  const syncState =
    row.sync_state === "synced" ||
    row.sync_state === "partial" ||
    row.sync_state === "failed" ||
    row.sync_state === "manual_only" ||
    row.sync_state === "disabled" ||
    row.sync_state === "stale"
      ? row.sync_state
      : "pending";
  const syncMode =
    row.sync_mode === "automatic" ||
    row.sync_mode === "manual" ||
    row.sync_mode === "disabled"
      ? row.sync_mode
      : "automatic";
  const syncScope =
    row.sync_scope === "organization" ||
    row.sync_scope === "branch" ||
    row.sync_scope === "customer"
      ? row.sync_scope
      : "global";
  const direction =
    row.last_direction === "to_crm" ||
    row.last_direction === "from_crm" ||
    row.last_direction === "bidirectional"
      ? row.last_direction
      : null;
  const entityType =
    row.local_entity_type === "deal" ? "deal" : "contact";
  const externalEntityType =
    row.external_entity_type === "deal" ? "deal" : "contact";
  return {
    id: String(row.id ?? ""),
    provider:
      row.provider === "nango" || row.nango_provider === "nango"
        ? "nango"
        : "nango",
    provider_config_key: String(row.provider_config_key ?? row.nango_provider ?? "nango"),
    connection_id: String(row.connection_id ?? ""),
    local_entity_type: entityType,
    local_record_id: String(row.local_record_id ?? ""),
    local_record_label: row.local_record_label != null ? String(row.local_record_label) : null,
    external_entity_type: externalEntityType,
    external_record_id: row.external_record_id != null ? String(row.external_record_id) : null,
    external_account_id:
      row.external_account_id != null ? String(row.external_account_id) : null,
    sync_state: syncState,
    sync_mode: syncMode,
    sync_scope: syncScope,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    tags:
      row.tags && typeof row.tags === "object" && !Array.isArray(row.tags)
        ? (row.tags as Record<string, unknown>)
        : {},
    last_error_code: row.last_error_code != null ? String(row.last_error_code) : null,
    last_error: row.last_error != null ? String(row.last_error) : null,
    last_failed_step:
      row.last_failed_step != null ? String(row.last_failed_step) : null,
    last_synced_at:
      row.last_synced_at != null ? String(row.last_synced_at) : null,
    last_synced_by_email:
      row.last_synced_by_email != null ? String(row.last_synced_by_email) : null,
    last_direction: direction,
    correlation_id:
      row.correlation_id != null ? String(row.correlation_id) : null,
    created_by_email:
      row.created_by_email != null ? String(row.created_by_email) : null,
    updated_by_email:
      row.updated_by_email != null ? String(row.updated_by_email) : null,
    created_at: String(row.created_at ?? nowIso()),
    updated_at: String(row.updated_at ?? nowIso()),
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function listCrmIntegrationConnections(
  supabase: SupabaseClient,
  options: { provider?: CrmIntegrationProvider; organizationId?: string; limit?: number } = {},
): Promise<CrmIntegrationConnectionRow[]> {
  const limit = Math.min(500, Math.max(1, options.limit ?? 100));
  let query = supabase
    .from("crm_nango_connections")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (options.provider) {
    query = query.eq("provider", options.provider);
  }
  if (options.organizationId) {
    query = query.eq("organization_id", options.organizationId.trim());
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => rowToConnection(row as Record<string, unknown>));
}

export async function upsertCrmIntegrationConnection(
  supabase: SupabaseClient,
  input: {
    provider?: CrmIntegrationProvider;
    provider_config_key: string;
    connection_id: string;
    connection_name?: string | null;
    organization_id?: string | null;
    branch_id?: string | null;
    staff_user_id?: string | null;
    staff_email?: string | null;
    sync_scope?: CrmIntegrationSyncScope;
    active?: boolean;
    tags?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    last_authorized_at?: string | null;
    last_synced_at?: string | null;
    last_error?: string | null;
  },
): Promise<CrmIntegrationConnectionRow> {
  const payload = {
    provider: input.provider ?? "nango",
    provider_config_key: input.provider_config_key.trim(),
    connection_id: input.connection_id.trim(),
    connection_name: input.connection_name?.trim() || null,
    organization_id: input.organization_id?.trim() || null,
    branch_id: input.branch_id?.trim() || null,
    staff_user_id: input.staff_user_id?.trim() || null,
    staff_email: input.staff_email?.trim().toLowerCase() || null,
    sync_scope: input.sync_scope ?? "global",
    active: input.active ?? true,
    tags: input.tags ?? {},
    metadata: input.metadata ?? {},
    last_authorized_at: input.last_authorized_at ?? null,
    last_synced_at: input.last_synced_at ?? null,
    last_error: input.last_error ?? null,
    updated_at: nowIso(),
  };
  const { data, error } = await supabase
    .from("crm_nango_connections")
    .upsert(payload, { onConflict: "provider,provider_config_key,connection_id" })
    .select("*")
    .single();
  if (error) throw error;
  return rowToConnection(data as Record<string, unknown>);
}

export async function deleteCrmIntegrationConnection(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("crm_nango_connections").delete().eq("id", id);
  if (error) throw error;
}

export async function listCrmIntegrationRecords(
  supabase: SupabaseClient,
  options: {
    provider?: CrmIntegrationProvider;
    connectionId?: string;
    localEntityType?: CrmIntegrationRecordKind;
    limit?: number;
  } = {},
): Promise<CrmIntegrationRecordRow[]> {
  const limit = Math.min(500, Math.max(1, options.limit ?? 100));
  let query = supabase
    .from("crm_nango_records")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (options.provider) {
    query = query.eq("provider", options.provider);
  }
  if (options.connectionId) {
    query = query.eq("connection_id", options.connectionId.trim());
  }
  if (options.localEntityType) {
    query = query.eq("local_entity_type", options.localEntityType);
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => rowToRecord(row as Record<string, unknown>));
}

export async function upsertCrmIntegrationRecord(
  supabase: SupabaseClient,
  input: {
    provider?: CrmIntegrationProvider;
    provider_config_key: string;
    connection_id: string;
    local_entity_type: CrmIntegrationRecordKind;
    local_record_id: string;
    local_record_label?: string | null;
    external_entity_type?: CrmIntegrationRecordKind;
    external_record_id?: string | null;
    external_account_id?: string | null;
    sync_state?: CrmIntegrationSyncState;
    sync_mode?: CrmIntegrationSyncMode;
    sync_scope?: CrmIntegrationSyncScope;
    metadata?: Record<string, unknown>;
    tags?: Record<string, unknown>;
    last_error_code?: string | null;
    last_error?: string | null;
    last_failed_step?: string | null;
    last_synced_at?: string | null;
    last_synced_by_email?: string | null;
    last_direction?: CrmIntegrationRecordRow["last_direction"];
    correlation_id?: string | null;
    created_by_email?: string | null;
    updated_by_email?: string | null;
  },
): Promise<CrmIntegrationRecordRow> {
  const payload = {
    provider: input.provider ?? "nango",
    provider_config_key: input.provider_config_key.trim(),
    connection_id: input.connection_id.trim(),
    local_entity_type: input.local_entity_type,
    local_record_id: input.local_record_id.trim(),
    local_record_label: input.local_record_label?.trim() || null,
    external_entity_type: input.external_entity_type ?? input.local_entity_type,
    external_record_id: input.external_record_id?.trim() || null,
    external_account_id: input.external_account_id?.trim() || null,
    sync_state: input.sync_state ?? "pending",
    sync_mode: input.sync_mode ?? "automatic",
    sync_scope: input.sync_scope ?? "global",
    metadata: input.metadata ?? {},
    tags: input.tags ?? {},
    last_error_code: input.last_error_code ?? null,
    last_error: input.last_error ?? null,
    last_failed_step: input.last_failed_step ?? null,
    last_synced_at: input.last_synced_at ?? null,
    last_synced_by_email: input.last_synced_by_email ?? null,
    last_direction: input.last_direction ?? "bidirectional",
    correlation_id: input.correlation_id ?? null,
    created_by_email: input.created_by_email ?? null,
    updated_by_email: input.updated_by_email ?? null,
    updated_at: nowIso(),
  };
  const { data, error } = await supabase
    .from("crm_nango_records")
    .upsert(payload, {
      onConflict:
        "provider,provider_config_key,connection_id,local_entity_type,local_record_id,external_entity_type,external_record_id",
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToRecord(data as Record<string, unknown>);
}

export async function deleteCrmIntegrationRecord(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("crm_nango_records").delete().eq("id", id);
  if (error) throw error;
}
