import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type CatalogProviderKey = "stripe" | "xendit" | "paypal" | "cod" | "pancake_pos";

export type CatalogProviderArtifactType =
  | "product"
  | "price"
  | "payment_link"
  | "payment_session"
  | "checkout_order"
  | "manual_capture"
  | "shipping_order"
  | "tracking_record";

export type CatalogProviderSyncState =
  | "pending"
  | "synced"
  | "partial"
  | "failed"
  | "manual_only"
  | "disabled"
  | "stale";

export type CatalogProviderSyncMode = "automatic" | "manual" | "disabled";

export type CatalogProviderCapability = {
  key: string;
  label: string;
  enabled: boolean;
};

export type CatalogProviderDefinition = {
  key: CatalogProviderKey;
  label: string;
  section: "payments" | "fulfillment";
  summary: string;
  defaultSyncMode: CatalogProviderSyncMode;
  defaultArtifactTypes: CatalogProviderArtifactType[];
  capabilities: CatalogProviderCapability[];
};

export type CatalogProviderProjectionRow = {
  id: string;
  medusa_product_id: string;
  provider: CatalogProviderKey;
  artifact_type: CatalogProviderArtifactType;
  external_id: string | null;
  external_url: string | null;
  sync_state: CatalogProviderSyncState;
  sync_mode: CatalogProviderSyncMode;
  region_code: string | null;
  channel_code: string | null;
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

export type CatalogProviderPublishingDraft = {
  provider: CatalogProviderKey;
  enabled: boolean;
  includePaymentLink?: boolean;
  syncMode?: CatalogProviderSyncMode;
  regionCode?: string | null;
  channelCode?: string | null;
  metadata?: Record<string, unknown> | null;
  externalId?: string | null;
  externalUrl?: string | null;
  lastError?: string | null;
  lastErrorCode?: string | null;
  lastFailedStep?: string | null;
  lastSyncedAt?: string | null;
  lastWebhookEventId?: string | null;
  lastWebhookStatus?: string | null;
  correlationId?: string | null;
  idempotencyKey?: string | null;
  operatorEmail?: string | null;
};

export const CATALOG_PROVIDER_DEFINITIONS: CatalogProviderDefinition[] = [
  {
    key: "stripe",
    label: "Stripe",
    section: "payments",
    summary: "Catalog mirror plus hosted checkout artifacts.",
    defaultSyncMode: "automatic",
    defaultArtifactTypes: ["product", "price", "payment_link"],
    capabilities: [
      { key: "catalog_sync", label: "Mirrors product + price", enabled: true },
      { key: "payment_links", label: "Reusable payment links", enabled: true },
      { key: "embedded_checkout", label: "Embedded checkout", enabled: false },
      { key: "checkout_only", label: "Checkout-time only", enabled: false },
    ],
  },
  {
    key: "xendit",
    label: "Xendit",
    section: "payments",
    summary: "Checkout-time payment sessions and hosted links.",
    defaultSyncMode: "manual",
    defaultArtifactTypes: ["payment_session"],
    capabilities: [
      { key: "embedded_checkout", label: "Components checkout", enabled: true },
      { key: "channel_discovery", label: "Active payment channels", enabled: true },
      { key: "save_payment_method", label: "Save payment method", enabled: true },
      { key: "checkout_only", label: "Checkout-time only", enabled: true },
    ],
  },
  {
    key: "paypal",
    label: "PayPal",
    section: "payments",
    summary: "Checkout orders created at payment time.",
    defaultSyncMode: "manual",
    defaultArtifactTypes: ["checkout_order"],
    capabilities: [
      { key: "authorize_capture", label: "Authorize and capture", enabled: true },
      { key: "void", label: "Void authorized order", enabled: true },
      { key: "payment_links", label: "Payment links", enabled: false },
      { key: "checkout_only", label: "Checkout-time only", enabled: true },
    ],
  },
  {
    key: "cod",
    label: "Cash on delivery",
    section: "payments",
    summary: "Local manual capture and fulfillment approval.",
    defaultSyncMode: "manual",
    defaultArtifactTypes: ["manual_capture"],
    capabilities: [
      { key: "catalog_mirror", label: "Mirrors catalog", enabled: false },
      { key: "manual_capture", label: "Manual capture", enabled: true },
      { key: "checkout_only", label: "Checkout-time only", enabled: true },
    ],
  },
  {
    key: "pancake_pos",
    label: "Pancake POS",
    section: "fulfillment",
    summary: "Order forwarding, waybills, and shipment tracking.",
    defaultSyncMode: "manual",
    defaultArtifactTypes: ["shipping_order", "tracking_record"],
    capabilities: [
      { key: "catalog_mirror", label: "Mirrors catalog", enabled: false },
      { key: "logistics_bridge", label: "Fulfillment bridge", enabled: true },
      { key: "tracking", label: "Shipment tracking", enabled: true },
    ],
  },
];

function defFor(provider: CatalogProviderKey): CatalogProviderDefinition {
  return (
    CATALOG_PROVIDER_DEFINITIONS.find((def) => def.key === provider) ??
    CATALOG_PROVIDER_DEFINITIONS[0]
  );
}

function rowToProjection(row: Record<string, unknown>): CatalogProviderProjectionRow {
  return {
    id: String(row.id ?? ""),
    medusa_product_id: String(row.medusa_product_id ?? ""),
    provider: String(row.provider ?? "stripe") as CatalogProviderKey,
    artifact_type: String(row.artifact_type ?? "product") as CatalogProviderArtifactType,
    external_id: row.external_id != null ? String(row.external_id) : null,
    external_url: row.external_url != null ? String(row.external_url) : null,
    sync_state: String(row.sync_state ?? "pending") as CatalogProviderSyncState,
    sync_mode: String(row.sync_mode ?? "automatic") as CatalogProviderSyncMode,
    region_code: row.region_code != null ? String(row.region_code) : null,
    channel_code: row.channel_code != null ? String(row.channel_code) : null,
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
    last_failed_step: row.last_failed_step != null ? String(row.last_failed_step) : null,
    last_synced_at: row.last_synced_at != null ? String(row.last_synced_at) : null,
    last_webhook_event_id:
      row.last_webhook_event_id != null ? String(row.last_webhook_event_id) : null,
    last_webhook_status:
      row.last_webhook_status != null ? String(row.last_webhook_status) : null,
    correlation_id: row.correlation_id != null ? String(row.correlation_id) : null,
    idempotency_key: row.idempotency_key != null ? String(row.idempotency_key) : null,
    created_by_email: row.created_by_email != null ? String(row.created_by_email) : null,
    updated_by_email: row.updated_by_email != null ? String(row.updated_by_email) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function getCatalogProviderDefinition(
  provider: CatalogProviderKey,
): CatalogProviderDefinition {
  return defFor(provider);
}

export function defaultCatalogProviderDrafts(
  productId?: string,
): CatalogProviderPublishingDraft[] {
  return CATALOG_PROVIDER_DEFINITIONS.map((def) => ({
    provider: def.key,
    enabled: def.section === "payments",
    includePaymentLink: def.key === "stripe",
    syncMode: def.defaultSyncMode,
    regionCode: null,
    channelCode: null,
    metadata: {
      artifactTypes: def.defaultArtifactTypes,
      providerSection: def.section,
      productId: productId ?? null,
    },
  }));
}

export function buildCatalogProviderCapabilityMap(
  provider: CatalogProviderKey,
  opts?: { includePaymentLink?: boolean },
): Record<string, unknown> {
  const def = defFor(provider);
  return {
    provider: def.key,
    section: def.section,
    summary: def.summary,
    defaultArtifactTypes: def.defaultArtifactTypes,
    includePaymentLink: Boolean(opts?.includePaymentLink),
    capabilities: def.capabilities,
  };
}

export function expandProviderDraftToArtifactRows(input: {
  medusaProductId: string;
  draft: CatalogProviderPublishingDraft;
  currencyCode?: string;
  productTitle?: string;
  productHandle?: string;
  productDescription?: string | null;
  pricePhp?: number | null;
  actorEmail?: string | null;
  correlationId?: string | null;
  siteOrigin?: string | null;
}): Array<{
  provider: CatalogProviderKey;
  artifact_type: CatalogProviderArtifactType;
  external_id: string | null;
  external_url: string | null;
  sync_state: CatalogProviderSyncState;
  sync_mode: CatalogProviderSyncMode;
  region_code: string | null;
  channel_code: string | null;
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
}> {
  const def = defFor(input.draft.provider);
  const enabled = input.draft.enabled;
  const syncMode =
    input.draft.syncMode ?? def.defaultSyncMode;
  const metadataBase = {
    productId: input.medusaProductId,
    productTitle: input.productTitle ?? null,
    productHandle: input.productHandle ?? null,
    productDescription: input.productDescription ?? null,
    pricePhp: input.pricePhp ?? null,
    currencyCode: input.currencyCode ?? null,
    siteOrigin: input.siteOrigin ?? null,
    provider: def.key,
    section: def.section,
    includePaymentLink: Boolean(input.draft.includePaymentLink),
  };
  const common = {
    provider: def.key,
    sync_mode: enabled ? syncMode : "disabled",
    region_code: input.draft.regionCode ?? null,
    channel_code: input.draft.channelCode ?? null,
    capabilities: buildCatalogProviderCapabilityMap(def.key, {
      includePaymentLink: input.draft.includePaymentLink,
    }),
    metadata: {
      ...metadataBase,
      ...(input.draft.metadata ?? {}),
    },
    last_error_code: input.draft.lastErrorCode ?? null,
    last_error: input.draft.lastError ?? null,
    last_failed_step: input.draft.lastFailedStep ?? null,
    last_synced_at: input.draft.lastSyncedAt ?? null,
    last_webhook_event_id: input.draft.lastWebhookEventId ?? null,
    last_webhook_status: input.draft.lastWebhookStatus ?? null,
    correlation_id: input.draft.correlationId ?? input.correlationId ?? null,
    idempotency_key: input.draft.idempotencyKey ?? null,
    created_by_email: input.draft.operatorEmail ?? input.actorEmail ?? null,
    updated_by_email: input.draft.operatorEmail ?? input.actorEmail ?? null,
  };

  if (!enabled) {
    return def.defaultArtifactTypes.map((artifact_type) => ({
      ...common,
      artifact_type,
      external_id: null,
      external_url: null,
      sync_state: "disabled" as CatalogProviderSyncState,
    }));
  }

  if (def.key === "cod") {
    return [
      {
        ...common,
        artifact_type: "manual_capture",
        external_id: null,
        external_url: null,
        sync_state: "manual_only",
      },
    ];
  }

  if (def.key === "paypal") {
    return [
      {
        ...common,
        artifact_type: "checkout_order",
        external_id: null,
        external_url: null,
        sync_state: "manual_only",
      },
    ];
  }

  if (def.key === "xendit") {
    return [
      {
        ...common,
        artifact_type: "payment_session",
        external_id: null,
        external_url: null,
        sync_state: "manual_only",
      },
    ];
  }

  if (def.key === "pancake_pos") {
    return def.defaultArtifactTypes.map((artifact_type) => ({
      ...common,
      artifact_type,
      external_id: null,
      external_url: null,
      sync_state: "manual_only",
    }));
  }

  const rows: Array<{
    provider: CatalogProviderKey;
    artifact_type: CatalogProviderArtifactType;
    external_id: string | null;
    external_url: string | null;
    sync_state: CatalogProviderSyncState;
    sync_mode: CatalogProviderSyncMode;
    region_code: string | null;
    channel_code: string | null;
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
  }> = [
    {
      ...common,
      artifact_type: "product" as const,
      external_id: null,
      external_url: null,
      sync_state: "pending" as CatalogProviderSyncState,
    },
    {
      ...common,
      artifact_type: "price" as const,
      external_id: null,
      external_url: null,
      sync_state: "pending" as CatalogProviderSyncState,
    },
  ];
  if (input.draft.includePaymentLink) {
    rows.push({
      ...common,
      artifact_type: "payment_link" as const,
      external_id: null,
      external_url: null,
      sync_state: "pending" as CatalogProviderSyncState,
    });
  }
  return rows;
}

export async function listCatalogProviderProjections(
  supabase: SupabaseClient,
  options: { medusaProductId?: string } = {},
): Promise<CatalogProviderProjectionRow[]> {
  let q = supabase
    .from("catalog_provider_projections")
    .select("*")
    .order("provider")
    .order("artifact_type");
  if (options.medusaProductId) {
    q = q.eq("medusa_product_id", options.medusaProductId);
  }
  const { data, error } = await q;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    console.error("[catalog-provider-projections] list", error.message);
    return [];
  }
  return (data ?? []).map((row) => rowToProjection(row as Record<string, unknown>));
}

export async function upsertCatalogProviderProjection(
  supabase: SupabaseClient,
  input: {
    medusa_product_id: string;
    provider: CatalogProviderKey;
    artifact_type: CatalogProviderArtifactType;
    external_id?: string | null;
    external_url?: string | null;
    sync_state?: CatalogProviderSyncState;
    sync_mode?: CatalogProviderSyncMode;
    region_code?: string | null;
    channel_code?: string | null;
    capabilities?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
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
): Promise<CatalogProviderProjectionRow | null> {
  const existingQuery = supabase
    .from("catalog_provider_projections")
    .select("*")
    .eq("medusa_product_id", input.medusa_product_id)
    .eq("provider", input.provider)
    .eq("artifact_type", input.artifact_type)
    .maybeSingle();
  const { data: existingRow, error: existingError } = await existingQuery;
  if (existingError) {
    if (isMissingTableOrSchemaError(existingError)) return null;
    console.error("[catalog-provider-projections] get", existingError.message);
    return null;
  }
  const existing = existingRow ? rowToProjection(existingRow as Record<string, unknown>) : null;
  const row = {
    medusa_product_id: input.medusa_product_id,
    provider: input.provider,
    artifact_type: input.artifact_type,
    external_id: input.external_id ?? existing?.external_id ?? null,
    external_url: input.external_url ?? existing?.external_url ?? null,
    sync_state: input.sync_state ?? existing?.sync_state ?? "pending",
    sync_mode: input.sync_mode ?? existing?.sync_mode ?? "automatic",
    region_code: input.region_code ?? existing?.region_code ?? null,
    channel_code: input.channel_code ?? existing?.channel_code ?? null,
    capabilities: input.capabilities ?? existing?.capabilities ?? {},
    metadata: input.metadata ?? existing?.metadata ?? {},
    last_error_code: input.last_error_code ?? existing?.last_error_code ?? null,
    last_error: input.last_error ?? existing?.last_error ?? null,
    last_failed_step: input.last_failed_step ?? existing?.last_failed_step ?? null,
    last_synced_at: input.last_synced_at ?? existing?.last_synced_at ?? null,
    last_webhook_event_id:
      input.last_webhook_event_id ?? existing?.last_webhook_event_id ?? null,
    last_webhook_status: input.last_webhook_status ?? existing?.last_webhook_status ?? null,
    correlation_id: input.correlation_id ?? existing?.correlation_id ?? null,
    idempotency_key: input.idempotency_key ?? existing?.idempotency_key ?? null,
    created_by_email: input.created_by_email ?? existing?.created_by_email ?? null,
    updated_by_email: input.updated_by_email ?? existing?.updated_by_email ?? null,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("catalog_provider_projections")
      .update(row)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) {
      console.error("[catalog-provider-projections] update", error.message);
      return null;
    }
    return rowToProjection(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("catalog_provider_projections")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    console.error("[catalog-provider-projections] insert", error.message);
    return null;
  }
  return rowToProjection(data as Record<string, unknown>);
}

export async function upsertCatalogProviderProjections(
  supabase: SupabaseClient,
  inputs: Array<{
    medusa_product_id: string;
    provider: CatalogProviderKey;
    artifact_type: CatalogProviderArtifactType;
    external_id?: string | null;
    external_url?: string | null;
    sync_state?: CatalogProviderSyncState;
    sync_mode?: CatalogProviderSyncMode;
    region_code?: string | null;
    channel_code?: string | null;
    capabilities?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
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
  }>,
): Promise<CatalogProviderProjectionRow[]> {
  const out: CatalogProviderProjectionRow[] = [];
  for (const input of inputs) {
    const row = await upsertCatalogProviderProjection(supabase, input);
    if (row) out.push(row);
  }
  return out;
}

export async function clearCatalogProviderProjections(
  supabase: SupabaseClient,
  medusaProductId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("catalog_provider_projections")
    .delete()
    .eq("medusa_product_id", medusaProductId);
  if (error) {
    console.error("[catalog-provider-projections] delete", error.message);
    return false;
  }
  return true;
}
