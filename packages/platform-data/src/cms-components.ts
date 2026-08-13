import type { SupabaseClient } from "@supabase/supabase-js";
import { CMS_COMPONENT_DEFINITIONS } from "./cms-component-registry.js";
import type { CmsComponentDefinition } from "./cms-types.js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type CmsComponentDefinitionRow = {
  id: string;
  organization_id: string;
  component_key: string;
  definition: CmsComponentDefinition;
  version: number;
  status: "draft" | "published" | "archived";
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

function rowToDefinition(row: Record<string, unknown>): CmsComponentDefinitionRow {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    component_key: String(row.component_key),
    definition: row.definition as CmsComponentDefinition,
    version: Number(row.version) || 1,
    status: (row.status as CmsComponentDefinitionRow["status"]) ?? "draft",
    created_by: row.created_by == null ? null : String(row.created_by),
    updated_by: row.updated_by == null ? null : String(row.updated_by),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function listCmsComponentDefinitionsForOrganization(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<CmsComponentDefinitionRow[]> {
  const { data, error } = await supabase
    .from("cms_component_definitions")
    .select("*")
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .order("component_key");
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    console.error("[cms-components] list", error.message);
    return [];
  }
  return (data ?? []).map((row) => rowToDefinition(row as Record<string, unknown>));
}

export async function getCmsComponentDefinitionForOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  componentKey: string,
): Promise<CmsComponentDefinitionRow | null> {
  const { data, error } = await supabase
    .from("cms_component_definitions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("component_key", componentKey)
    .maybeSingle();
  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    console.error("[cms-components] get", error.message);
    return null;
  }
  return data ? rowToDefinition(data as Record<string, unknown>) : null;
}

export async function saveCmsComponentDefinition(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    componentKey: string;
    definition: CmsComponentDefinition;
    expectedVersion?: number;
    actorId?: string;
  },
): Promise<CmsComponentDefinitionRow | null> {
  const { data, error } = await supabase.rpc("save_cms_component_definition", {
    p_organization_id: input.organizationId,
    p_component_key: input.componentKey,
    p_definition: input.definition,
    p_expected_version: input.expectedVersion ?? null,
    p_actor_id: input.actorId ?? null,
  });
  if (error || !data) {
    if (error && !isMissingTableOrSchemaError(error)) console.error("[cms-components] save", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row ? rowToDefinition(row as Record<string, unknown>) : null;
}

export async function publishCmsComponentDefinition(
  supabase: SupabaseClient,
  organizationId: string,
  componentKey: string,
  expectedVersion: number,
  actorId?: string,
): Promise<CmsComponentDefinitionRow | null> {
  const { data, error } = await supabase
    .from("cms_component_definitions")
    .update({ status: "published", updated_by: actorId ?? null, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("component_key", componentKey)
    .eq("version", expectedVersion)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    if (error && !isMissingTableOrSchemaError(error)) console.error("[cms-components] publish", error.message);
    return null;
  }
  return rowToDefinition(data as Record<string, unknown>);
}

export async function archiveCmsComponentDefinition(
  supabase: SupabaseClient,
  organizationId: string,
  componentKey: string,
  expectedVersion: number,
  actorId?: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("cms_component_definitions")
    .update({ status: "archived", updated_by: actorId ?? null, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("component_key", componentKey)
    .eq("version", expectedVersion)
    .select("id")
    .maybeSingle();
  if (error && !isMissingTableOrSchemaError(error)) console.error("[cms-components] archive", error.message);
  return Boolean(data);
}

export function mergeCmsComponentDefinitions(
  stored: CmsComponentDefinitionRow[],
): CmsComponentDefinition[] {
  const byKey = new Map(stored.map((row) => [row.component_key, row.definition]));
  return CMS_COMPONENT_DEFINITIONS.map((definition) => byKey.get(definition.id) ?? definition);
}
