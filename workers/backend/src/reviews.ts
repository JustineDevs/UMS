import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthConfig } from "./auth.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS =
  "id, rating, author_name, image_url, body, created_at, product_slug, medusa_product_id, is_verified_buyer, helpful_votes";

function response(body: unknown, status = 200, cache = "no-store"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": cache },
  });
}

function cursor(value: string): { createdAt: string; id?: string } | null {
  if (!value) return null;
  const separator = value.lastIndexOf(":");
  if (separator < 1)
    return Number.isFinite(Date.parse(value)) ? { createdAt: value } : null;
  let createdAt = "";
  try {
    createdAt = decodeURIComponent(value.slice(0, separator));
  } catch {
    return null;
  }
  const id = value.slice(separator + 1);
  return Number.isFinite(Date.parse(createdAt)) && UUID.test(id)
    ? { createdAt, id }
    : null;
}

export async function handleReviewListRequest(
  request: Request,
  database: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "GET")
    return response({ error: "method_not_allowed" }, 405);
  const url = new URL(request.url);
  const productSlug = url.searchParams.get("productSlug")?.trim() || "";
  const productId = url.searchParams.get("medusaProductId")?.trim() || "";
  const rawLimit = url.searchParams.get("limit") || "20";
  const limit = /^\d+$/.test(rawLimit)
    ? Math.min(100, Math.max(1, Number(rawLimit)))
    : 20;
  if (!productSlug && !productId)
    return response({ error: "product_identity_required" }, 400);
  const decoded = cursor(url.searchParams.get("cursor")?.trim() || "");
  if (url.searchParams.has("cursor") && !decoded)
    return response({ error: "invalid_review_cursor" }, 400);
  const values: unknown[] = [];
  const filters = ["status = 'approved'", "shadow_banned = false"];
  if (productId) {
    values.push(productId);
    filters.push(`medusa_product_id = $${values.length}`);
  } else {
    values.push(productSlug);
    filters.push(`product_slug = $${values.length}`);
  }
  if (decoded?.id) {
    values.push(decoded.createdAt, decoded.id);
    filters.push(
      `(created_at < $${values.length - 1} OR (created_at = $${values.length - 1} AND id < $${values.length}))`,
    );
  } else if (decoded) {
    values.push(decoded.createdAt);
    filters.push(`created_at < $${values.length}`);
  }
  values.push(limit);
  const result = await database.query<Record<string, unknown>>(
    `SELECT ${FIELDS} FROM public.product_reviews WHERE ${filters.join(" AND ")}
     ORDER BY created_at DESC, id DESC LIMIT $${values.length}`,
    values,
  );
  const rows = result.rows;
  const last = rows.at(-1);
  const nextCursor =
    rows.length === limit &&
    typeof last?.created_at === "string" &&
    typeof last.id === "string"
      ? `${encodeURIComponent(last.created_at)}:${last.id}`
      : null;
  return response(
    { reviews: rows, nextCursor },
    200,
    "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
  );
}

type ReviewCreateEnv = WorkerAuthConfig;

function normalizedEmail(
  claims: Awaited<ReturnType<typeof verifyWorkerBearerToken>>,
): string | null {
  const email =
    typeof claims?.email === "string" ? claims.email.trim().toLowerCase() : "";
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function fallbackAuthorName(email: string): string {
  return email.split("@")[0]?.slice(0, 120) || "Customer";
}

/** Creates a moderated review using the authenticated Worker identity and commerce database. */
export async function handleReviewCreateRequest(
  request: Request,
  appDatabase: WorkerDatabaseClient,
  commerceDatabase: WorkerDatabaseClient,
  env: ReviewCreateEnv,
): Promise<Response> {
  if (request.method !== "POST")
    return response({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(
    request.headers.get("Authorization"),
    env,
  );
  if (!claims)
    return response({ error: "unauthorized", code: "AUTH_REQUIRED" }, 401);
  const email = normalizedEmail(claims);
  if (!email) return response({ error: "authenticated_email_required" }, 401);

  let input: Record<string, unknown>;
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value))
      return response({ error: "invalid_review_payload" }, 400);
    input = value as Record<string, unknown>;
  } catch {
    return response({ error: "invalid_json" }, 400);
  }
  const productSlug =
    typeof input.productSlug === "string" ? input.productSlug.trim() : "";
  const productId =
    typeof input.medusaProductId === "string"
      ? input.medusaProductId.trim()
      : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const rating =
    typeof input.rating === "number" ? input.rating : Number(input.rating);
  if (
    !productSlug ||
    !productId ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5 ||
    body.length < 1 ||
    body.length > 2000
  ) {
    return response({ error: "invalid_review_payload" }, 400);
  }

  const customerId = claims.sub.trim();
  const bodyHash = await sha256Hex(body.toLowerCase().replace(/\s+/g, " "));
  const duplicate = await appDatabase.query<{ id: string }>(
    `SELECT id FROM public.product_reviews
      WHERE body_hash = $1 AND status IN ('pending', 'approved', 'hidden') LIMIT 1`,
    [bodyHash],
  );
  if (duplicate.rows[0])
    return response(
      { error: "duplicate_review", code: "DUPLICATE_REVIEW" },
      409,
    );

  const verified = await commerceDatabase.query<{ id: string }>(
    `SELECT o.id
       FROM public."order" o
       JOIN public.order_item oi ON oi.order_id = o.id AND oi.deleted_at IS NULL
       JOIN public.order_line_item oli ON oli.id = oi.item_id AND oli.deleted_at IS NULL
      WHERE o.deleted_at IS NULL
        AND (o.customer_id = $1 OR lower(o.email) = $2)
        AND (lower(o.status) IN ('completed', 'archived')
          OR EXISTS (
            SELECT 1
              FROM public.order_payment_collection opc
              JOIN public.payment_collection pc ON pc.id = opc.payment_collection_id
             WHERE opc.order_id = o.id
               AND pc.deleted_at IS NULL
               AND pc.status IN ('captured', 'partially_refunded', 'completed')
          ))
        AND oli.product_id = $3
      ORDER BY o.created_at DESC LIMIT 1`,
    [customerId, email, productId],
  );
  const verifiedOrderId = verified.rows[0]?.id ?? null;
  const authorName =
    typeof input.authorName === "string" && input.authorName.trim()
      ? input.authorName.trim().slice(0, 120)
      : fallbackAuthorName(email);
  const imageUrl =
    typeof input.imageUrl === "string" && input.imageUrl.trim()
      ? input.imageUrl.trim()
      : null;
  try {
    await appDatabase.query(
      `INSERT INTO public.product_reviews
        (product_slug, medusa_product_id, rating, author_name, image_url, body, body_hash,
         risk_score, shadow_banned, status, medusa_customer_id, customer_email,
         is_verified_buyer, verified_medusa_order_id, verified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,'pending',$9,$10,$11,$12,$13)`,
      [
        productSlug,
        productId,
        rating,
        authorName,
        imageUrl,
        body,
        bodyHash,
        verifiedOrderId ? 0 : 20,
        customerId,
        email,
        Boolean(verifiedOrderId),
        verifiedOrderId,
        verifiedOrderId ? new Date().toISOString() : null,
      ],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("duplicate") || message.includes("unique")) {
      return response(
        { error: "duplicate_review", code: "DUPLICATE_REVIEW" },
        409,
      );
    }
    throw error;
  }
  return response({
    ok: true,
    status: "pending",
    isVerifiedBuyer: Boolean(verifiedOrderId),
  });
}
