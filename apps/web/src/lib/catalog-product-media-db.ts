import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveCatalogMediaReferences(
  supabase: SupabaseClient,
  mediaIds: readonly string[],
  organizationId: string,
): Promise<string[]> {
  const ids = [...new Set(mediaIds.flatMap((id) => {
    const trimmed = id.trim();
    return trimmed ? [trimmed] : [];
  }))];
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("cms_media")
    .select("id,public_url")
    .in("id", ids)
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  if (error) throw new Error("Unable to validate catalog media references");
  const urls = new Map<string, string>();
  for (const row of data ?? []) {
    if (typeof row.public_url !== "string" || !row.public_url.trim()) continue;
    urls.set(String(row.id), row.public_url.trim());
  }
  if (urls.size !== ids.length) {
    throw new Error("One or more catalog media references are unavailable");
  }
  return ids.map((id) => urls.get(id) as string);
}
