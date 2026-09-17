import { createClient } from "@supabase/supabase-js";

export type ProductQaRow = {
  id: string;
  question: string;
  answer: string;
  created_at: string;
};

export async function fetchProductQaEntries(
  productSlug: string,
  options?: { medusaProductId?: string; limit?: number },
): Promise<ProductQaRow[]> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  const slug = productSlug.trim();
  const mid = options?.medusaProductId?.trim();
  const limit = options?.limit ?? 40;
  if (!url || !key || !slug) return [];
  const sb = createClient(url, key);
  const { data: bySlug, error: e1 } = await sb
    .from("product_qa_entries")
    .select("id,question,answer,created_at,sort_order")
    .eq("status", "approved")
    .eq("product_slug", slug)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (e1) return [];
  const rows: ProductQaRow[] = (bySlug ?? []).map(
    ({ id, question, answer, created_at }) => ({
      id,
      question,
      answer,
      created_at,
    }),
  );
  const seen = new Set(rows.map((r) => r.id));
  if (mid) {
    const { data: byMid, error: e2 } = await sb
      .from("product_qa_entries")
      .select("id,question,answer,created_at,sort_order")
      .eq("status", "approved")
      .eq("medusa_product_id", mid)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!e2 && byMid) {
      for (const row of byMid) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        rows.push({
          id: row.id,
          question: row.question,
          answer: row.answer,
          created_at: row.created_at,
        });
      }
    }
  }
  return rows.slice(0, limit);
}
