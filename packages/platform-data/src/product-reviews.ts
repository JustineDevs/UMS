import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductReviewStatus = "pending" | "approved" | "rejected" | "hidden";

export type ProductReviewRow = {
  id: string;
  product_slug: string;
  medusa_product_id: string | null;
  rating: number;
  author_name: string;
  image_url: string | null;
  body: string;
  status: ProductReviewStatus;
  created_at: string;
  customer_email: string | null;
  medusa_customer_id: string | null;
  is_verified_buyer: boolean | null;
  verified_medusa_order_id: string | null;
  verified_at: string | null;
  moderated_by_staff_email: string | null;
  moderated_at: string | null;
  moderation_note: string | null;
  helpful_votes: number | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function rowToReview(row: Record<string, unknown>): ProductReviewRow {
  const status =
    row.status === "approved" ||
    row.status === "rejected" ||
    row.status === "hidden" ||
    row.status === "pending"
      ? row.status
      : "pending";
  return {
    id: String(row.id ?? ""),
    product_slug: String(row.product_slug ?? ""),
    medusa_product_id: row.medusa_product_id != null ? String(row.medusa_product_id) : null,
    rating: Number(row.rating ?? 0),
    author_name: String(row.author_name ?? ""),
    image_url: row.image_url != null ? String(row.image_url) : null,
    body: String(row.body ?? ""),
    status,
    created_at: String(row.created_at ?? ""),
    customer_email: row.customer_email != null ? String(row.customer_email) : null,
    medusa_customer_id: row.medusa_customer_id != null ? String(row.medusa_customer_id) : null,
    is_verified_buyer: typeof row.is_verified_buyer === "boolean" ? row.is_verified_buyer : null,
    verified_medusa_order_id:
      row.verified_medusa_order_id != null ? String(row.verified_medusa_order_id) : null,
    verified_at: row.verified_at != null ? String(row.verified_at) : null,
    moderated_by_staff_email:
      row.moderated_by_staff_email != null ? String(row.moderated_by_staff_email) : null,
    moderated_at: row.moderated_at != null ? String(row.moderated_at) : null,
    moderation_note: row.moderation_note != null ? String(row.moderation_note) : null,
    helpful_votes:
      typeof row.helpful_votes === "number"
        ? row.helpful_votes
        : row.helpful_votes != null
          ? Number(row.helpful_votes)
          : null,
  };
}

export type ListProductReviewsOptions = {
  status?: ProductReviewStatus | "";
  productSlug?: string;
  medusaProductId?: string;
  q?: string;
  limit?: number;
};

export async function listProductReviews(
  supabase: SupabaseClient,
  options: ListProductReviewsOptions = {},
): Promise<ProductReviewRow[]> {
  const limit = Math.min(250, Math.max(1, options.limit ?? 80));
  let query = supabase
    .from("product_reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.status) {
    query = query.eq("status", options.status);
  }
  if (options.productSlug?.trim()) {
    query = query.eq("product_slug", options.productSlug.trim());
  }
  if (options.medusaProductId?.trim()) {
    query = query.eq("medusa_product_id", options.medusaProductId.trim());
  }
  if (options.q?.trim()) {
    const safe = options.q.trim().replace(/[%_]/g, " ").trim();
    if (safe.length >= 2) {
      query = query.or(
        `body.ilike.%${safe}%,author_name.ilike.%${safe}%,customer_email.ilike.%${safe}%`,
      );
    }
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }
  return (data as Record<string, unknown>[]).map(rowToReview);
}

export type CreateProductReviewInput = {
  product_slug: string;
  medusa_product_id?: string | null;
  rating: number;
  author_name: string;
  body: string;
  image_url?: string | null;
  status?: ProductReviewStatus;
  customer_email?: string | null;
  medusa_customer_id?: string | null;
  is_verified_buyer?: boolean | null;
  verified_medusa_order_id?: string | null;
  verified_at?: string | null;
  moderated_by_staff_email?: string | null;
  moderated_at?: string | null;
  moderation_note?: string | null;
};

export async function createProductReview(
  supabase: SupabaseClient,
  input: CreateProductReviewInput,
): Promise<ProductReviewRow | null> {
  const payload = {
    product_slug: input.product_slug.trim(),
    medusa_product_id: input.medusa_product_id?.trim() || null,
    rating: Number(input.rating),
    author_name: input.author_name.trim(),
    image_url: input.image_url?.trim() || null,
    body: input.body.trim(),
    status:
      input.status === "approved" ||
      input.status === "rejected" ||
      input.status === "hidden" ||
      input.status === "pending"
        ? input.status
        : "pending",
    customer_email: input.customer_email?.trim() || null,
    medusa_customer_id: input.medusa_customer_id?.trim() || null,
    is_verified_buyer: input.is_verified_buyer ?? false,
    verified_medusa_order_id: input.verified_medusa_order_id?.trim() || null,
    verified_at: input.verified_at ?? null,
    moderated_by_staff_email: input.moderated_by_staff_email?.trim() || null,
    moderated_at: input.moderated_at ?? null,
    moderation_note: input.moderation_note?.trim() || null,
  };
  const { data, error } = await supabase.from("product_reviews").insert(payload).select("*").single();
  if (error || !data) {
    return null;
  }
  return rowToReview(data as Record<string, unknown>);
}

export type UpdateProductReviewInput = Partial<CreateProductReviewInput> & {
  status?: ProductReviewStatus;
};

export async function updateProductReview(
  supabase: SupabaseClient,
  id: string,
  patch: UpdateProductReviewInput,
): Promise<ProductReviewRow | null> {
  const payload: Record<string, unknown> = {};
  if (patch.product_slug !== undefined) payload.product_slug = patch.product_slug.trim();
  if (patch.medusa_product_id !== undefined) {
    payload.medusa_product_id = patch.medusa_product_id?.trim() || null;
  }
  if (patch.rating !== undefined) payload.rating = Number(patch.rating);
  if (patch.author_name !== undefined) payload.author_name = patch.author_name.trim();
  if (patch.image_url !== undefined) {
    payload.image_url = patch.image_url?.trim() || null;
  }
  if (patch.body !== undefined) payload.body = patch.body.trim();
  if (
    patch.status === "approved" ||
    patch.status === "rejected" ||
    patch.status === "hidden" ||
    patch.status === "pending"
  ) {
    payload.status = patch.status;
  }
  if (patch.customer_email !== undefined) {
    payload.customer_email = patch.customer_email?.trim() || null;
  }
  if (patch.medusa_customer_id !== undefined) {
    payload.medusa_customer_id = patch.medusa_customer_id?.trim() || null;
  }
  if (patch.is_verified_buyer !== undefined) payload.is_verified_buyer = patch.is_verified_buyer;
  if (patch.verified_medusa_order_id !== undefined) {
    payload.verified_medusa_order_id = patch.verified_medusa_order_id?.trim() || null;
  }
  if (patch.verified_at !== undefined) payload.verified_at = patch.verified_at || null;
  if (patch.moderated_by_staff_email !== undefined) {
    payload.moderated_by_staff_email = patch.moderated_by_staff_email?.trim() || null;
  }
  if (patch.moderated_at !== undefined) payload.moderated_at = patch.moderated_at || null;
  if (patch.moderation_note !== undefined) {
    payload.moderation_note = patch.moderation_note?.trim() || null;
  }

  if (Object.keys(payload).length === 0) {
    const { data } = await supabase.from("product_reviews").select("*").eq("id", id).maybeSingle();
    return data ? rowToReview(data as Record<string, unknown>) : null;
  }

  const { data, error } = await supabase
    .from("product_reviews")
    .update(payload)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return rowToReview(data as Record<string, unknown>);
}

export async function getProductReviewById(
  supabase: SupabaseClient,
  id: string,
): Promise<ProductReviewRow | null> {
  const { data, error } = await supabase.from("product_reviews").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return rowToReview(data as Record<string, unknown>);
}

export async function deleteProductReview(
  supabase: SupabaseClient,
  id: string,
): Promise<boolean> {
  const { error } = await supabase.from("product_reviews").delete().eq("id", id);
  return !error;
}

export function isProductReviewRecord(value: unknown): value is ProductReviewRow {
  return isRecord(value) && typeof value.id === "string" && typeof value.body === "string";
}
