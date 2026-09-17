import type { SupabaseClient } from "@supabase/supabase-js";

export async function listOperatorNotes(
  client: SupabaseClient,
  entityType: string,
  entityId: string,
  limit = 50,
): Promise<
  Array<{
    id: string;
    body: string;
    author_email: string | null;
    created_at: string;
  }>
> {
  const { data, error } = await client
    .from("admin_operator_notes")
    .select("id,body,author_email,created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row: Record<string, unknown>) => {
    const r = row;
    return {
      id: String(r.id ?? ""),
      body: String(r.body ?? ""),
      author_email:
        typeof r.author_email === "string" ? r.author_email : null,
      created_at:
        typeof r.created_at === "string"
          ? r.created_at
          : new Date().toISOString(),
    };
  });
}

export async function createOperatorNote(
  client: SupabaseClient,
  input: {
    entityType: string;
    entityId: string;
    body: string;
    authorEmail: string | null;
  },
): Promise<{ id: string } | null> {
  const { data, error } = await client
    .from("admin_operator_notes")
    .insert({
      entity_type: input.entityType,
      entity_id: input.entityId,
      body: input.body.trim(),
      author_email: input.authorEmail,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) return null;
  return { id: String((data as { id: string }).id) };
}
