import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";

export const dynamic = "force-dynamic";

const READ_PERM = "content:read";

/**
 * List product reviews for moderation (all statuses). Staff: `content:read`.
 */
export async function GET(req: Request) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession(READ_PERM);
  if (!staff.ok) {
    return staff.response;
  }

  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) {
    return sup.response;
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status")?.trim().toLowerCase() ?? "";
  const productId = url.searchParams.get("medusaProductId")?.trim() ?? "";
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const limit = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("limit")) || 80),
  );

  let query = sup.client
    .from("product_reviews")
    .select(
      "id,product_slug,medusa_product_id,rating,author_name,body,status,created_at,is_verified_buyer,moderated_at,moderation_note",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (
    status &&
    ["pending", "approved", "rejected", "hidden"].includes(status)
  ) {
    query = query.eq("status", status);
  }
  if (productId) {
    query = query.eq("medusa_product_id", productId);
  }
  if (q.length >= 2) {
    const safe = q.replace(/[%_]/g, " ").trim();
    if (safe.length >= 2) {
      query = query.ilike("body", `%${safe}%`);
    }
  }

  const { data, error } = await query;
  if (error) {
    return correlatedJson(
      correlationId,
      { error: "Unable to load reviews", code: "REVIEWS_QUERY_FAILED" },
      { status: 502 },
    );
  }

  return correlatedJson(correlationId, { reviews: data ?? [] });
}
