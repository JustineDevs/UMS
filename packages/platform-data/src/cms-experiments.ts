import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type CmsAbExperimentRow = {
  id: string;
  organization_id: string | null;
  experiment_key: string;
  name: string;
  variants: unknown;
  active: boolean;
  updated_at: string;
  starts_at: string | null;
  ends_at: string | null;
  traffic_cap_pct: number | null;
  target_page_slug: string | null;
  target_component_key: string | null;
  impressions: number;
  conversions: number;
};

export async function listCmsAbExperiments(
  supabase: SupabaseClient,
  organizationId?: string,
): Promise<CmsAbExperimentRow[]> {
  let query = supabase.from("cms_ab_experiments").select("*").order("experiment_key");
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    console.error("[cms-experiments] list", error.message);
    return [];
  }
  return (data ?? []).map((r) => {
    const x = r as Record<string, unknown>;
    return {
      id: String(x.id),
      organization_id: x.organization_id != null ? String(x.organization_id) : null,
      experiment_key: String(x.experiment_key ?? ""),
      name: String(x.name ?? ""),
      variants: x.variants ?? [],
      active: Boolean(x.active),
      updated_at: String(x.updated_at ?? ""),
      starts_at: x.starts_at != null ? String(x.starts_at) : null,
      ends_at: x.ends_at != null ? String(x.ends_at) : null,
      traffic_cap_pct:
        x.traffic_cap_pct != null && x.traffic_cap_pct !== ""
          ? Number(x.traffic_cap_pct)
          : null,
      target_page_slug: x.target_page_slug != null ? String(x.target_page_slug) : null,
      target_component_key: x.target_component_key != null ? String(x.target_component_key) : null,
      impressions: Number(x.impressions) || 0,
      conversions: Number(x.conversions) || 0,
    };
  });
}

export async function upsertCmsAbExperiment(
  supabase: SupabaseClient,
  input: {
    id?: string;
    organization_id?: string;
    experiment_key: string;
    name?: string;
    variants: unknown;
    active?: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
    traffic_cap_pct?: number | null;
    target_page_slug?: string | null;
    target_component_key?: string | null;
    impressions?: number;
    conversions?: number;
  },
): Promise<CmsAbExperimentRow | null> {
  const existing = input.id
    ? (await supabase.from("cms_ab_experiments").select("*").eq("id", input.id).eq("organization_id", input.organization_id ?? "").maybeSingle()).data
    : null;
  const ex = existing as Record<string, unknown> | null;
  const row = {
    ...(input.organization_id ? { organization_id: input.organization_id } : {}),
    experiment_key: input.experiment_key,
    name: input.name ?? (ex ? String(ex.name ?? "") : ""),
    variants: input.variants ?? (ex?.variants ?? []),
    active: input.active ?? (ex ? Boolean(ex.active) : false),
    starts_at:
      input.starts_at !== undefined ? input.starts_at : ex?.starts_at != null ? String(ex.starts_at) : null,
    ends_at: input.ends_at !== undefined ? input.ends_at : ex?.ends_at != null ? String(ex.ends_at) : null,
    traffic_cap_pct:
      input.traffic_cap_pct !== undefined
        ? input.traffic_cap_pct
        : ex?.traffic_cap_pct != null
          ? Number(ex.traffic_cap_pct)
          : null,
    target_page_slug:
      input.target_page_slug !== undefined
        ? input.target_page_slug
        : ex?.target_page_slug != null
          ? String(ex.target_page_slug)
          : null,
    target_component_key:
      input.target_component_key !== undefined
        ? input.target_component_key
        : ex?.target_component_key != null
          ? String(ex.target_component_key)
          : null,
    impressions:
      input.impressions !== undefined
        ? input.impressions
        : ex?.impressions != null
          ? Number(ex.impressions)
          : 0,
    conversions:
      input.conversions !== undefined
        ? input.conversions
        : ex?.conversions != null
          ? Number(ex.conversions)
          : 0,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { data, error } = await supabase
      .from("cms_ab_experiments")
      .update(row)
      .eq("id", input.id)
      .eq("organization_id", input.organization_id ?? "")
      .select("*")
      .single();
    if (error) {
      console.error("[cms-experiments] update", error.message);
      return null;
    }
    const x = data as Record<string, unknown>;
    return {
      id: String(x.id),
      organization_id: x.organization_id != null ? String(x.organization_id) : null,
      experiment_key: String(x.experiment_key ?? ""),
      name: String(x.name ?? ""),
      variants: x.variants ?? [],
      active: Boolean(x.active),
      updated_at: String(x.updated_at ?? ""),
      starts_at: x.starts_at != null ? String(x.starts_at) : null,
      ends_at: x.ends_at != null ? String(x.ends_at) : null,
      traffic_cap_pct:
        x.traffic_cap_pct != null && x.traffic_cap_pct !== "" ? Number(x.traffic_cap_pct) : null,
      target_page_slug: x.target_page_slug != null ? String(x.target_page_slug) : null,
      target_component_key: x.target_component_key != null ? String(x.target_component_key) : null,
      impressions: Number(x.impressions) || 0,
      conversions: Number(x.conversions) || 0,
    };
  }
  const { data, error } = await supabase
    .from("cms_ab_experiments")
    .upsert(row, { onConflict: "organization_id,experiment_key" })
    .select("*")
    .single();
  if (error) {
    console.error("[cms-experiments] insert", error.message);
    return null;
  }
  const x = data as Record<string, unknown>;
  return {
    id: String(x.id),
    organization_id: x.organization_id != null ? String(x.organization_id) : null,
    experiment_key: String(x.experiment_key ?? ""),
    name: String(x.name ?? ""),
    variants: x.variants ?? [],
    active: Boolean(x.active),
    updated_at: String(x.updated_at ?? ""),
    starts_at: x.starts_at != null ? String(x.starts_at) : null,
    ends_at: x.ends_at != null ? String(x.ends_at) : null,
    traffic_cap_pct:
      x.traffic_cap_pct != null && x.traffic_cap_pct !== "" ? Number(x.traffic_cap_pct) : null,
    target_page_slug: x.target_page_slug != null ? String(x.target_page_slug) : null,
    target_component_key: x.target_component_key != null ? String(x.target_component_key) : null,
    impressions: Number(x.impressions) || 0,
    conversions: Number(x.conversions) || 0,
  };
}

/**
 * Increments the aggregate impressions counter for an experiment (e.g. public assign/track flow).
 */
export async function incrementCmsAbExperimentImpressions(
  supabase: SupabaseClient,
  experimentKey: string,
): Promise<boolean> {
  const key = experimentKey.trim();
  if (!key) return false;
  const { data, error: selErr } = await supabase
    .from("cms_ab_experiments")
    .select("impressions")
    .eq("experiment_key", key)
    .maybeSingle();
  if (selErr || !data) return false;
  const row = data as { impressions?: number | null };
  const next = (Number(row.impressions) || 0) + 1;
  const { error: upErr } = await supabase
    .from("cms_ab_experiments")
    .update({ impressions: next, updated_at: new Date().toISOString() })
    .eq("experiment_key", key);
  return !upErr;
}
