import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";
import type { CmsBlock, CmsPageBlockPresetRow } from "./cms-types.js";

function stableBlockId(index: number, type: string, props: Record<string, unknown>): string {
  const input = `${index}:${type}:${JSON.stringify(props)}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `blk_${(hash >>> 0).toString(36)}`;
}

export function parseCmsPagePresetBlocks(v: unknown): CmsBlock[] {
  if (!Array.isArray(v)) return [];
  const out: CmsBlock[] = [];
  for (const [index, item] of v.entries()) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const type = typeof r.type === "string" ? r.type : "unknown";
    const props =
      r.props && typeof r.props === "object" && r.props !== null
        ? (r.props as Record<string, unknown>)
        : {};
    const id = typeof r.id === "string" ? r.id : stableBlockId(index, type, props);
    out.push({ id, type, props });
  }
  return out;
}

export async function listCmsPageBlockPresets(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<CmsPageBlockPresetRow[]> {
  const { data, error } = await supabase
    .from("cms_page_block_presets")
    .select("id, name, blocks, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    console.error("[cms-page-block-presets] list", error.message);
    return [];
  }
  return (data ?? []).map((r) => {
    const x = r as Record<string, unknown>;
    return {
      id: String(x.id),
      name: String(x.name ?? ""),
      blocks: parseCmsPagePresetBlocks(x.blocks),
      created_at: String(x.created_at ?? ""),
    };
  });
}

export async function insertCmsPageBlockPreset(
  supabase: SupabaseClient,
  input: { name: string; blocks: CmsBlock[]; organizationId: string },
): Promise<CmsPageBlockPresetRow | null> {
  const { data, error } = await supabase
    .from("cms_page_block_presets")
    .insert({
      name: input.name.trim(),
      blocks: input.blocks as unknown as Record<string, unknown>[],
      organization_id: input.organizationId,
    })
    .select("id, name, blocks, created_at")
    .single();
  if (error) {
    console.error("[cms-page-block-presets] insert", error.message);
    return null;
  }
  const x = data as Record<string, unknown>;
  return {
    id: String(x.id),
    name: String(x.name ?? ""),
    blocks: parseCmsPagePresetBlocks(x.blocks),
    created_at: String(x.created_at ?? ""),
  };
}

export async function deleteCmsPageBlockPreset(
  supabase: SupabaseClient,
  id: string,
  organizationId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("cms_page_block_presets")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error) {
    console.error("[cms-page-block-presets] delete", error.message);
    return false;
  }
  return true;
}
