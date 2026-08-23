import { getStorefrontSession } from "@/lib/auth";
import { findOrCreateMedusaCustomerIdByEmail } from "@/lib/medusa-customer-resolve";
import { findVerifiedProductPurchaseForCustomer } from "@/lib/medusa-review-verification";
import {
  createStorefrontAnonSupabase,
  createStorefrontServiceSupabase,
} from "@/lib/storefront-supabase";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import { withBotIdProtection } from "@/lib/botid-protection";
import {
  isRecaptchaConfigured,
  verifyRecaptchaAction,
} from "@/lib/recaptcha-enterprise";
import {
  storefrontReviewPostBodySchema,
  storefrontReviewsListQuerySchema,
} from "@universal-music-store/validation";
import {
  reviewBodyHash,
  reviewFormTimingIsValid,
  validateReviewBody,
} from "@/lib/review-content";
import { reviewCsrfCookieName, verifyReviewCsrfToken } from "@/lib/review-csrf";
import { isSameOriginMutation } from "@/lib/request-origin";
import {
  decodeReviewCursor,
  encodeReviewCursor,
  PUBLIC_REVIEW_FIELDS,
} from "@/lib/review-api-contract";
import { parseBoundedJson } from "@/lib/bounded-request-body";

const MAX_REVIEW_BODY_BYTES = 16 * 1024;

export async function GET(req: Request) {
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`reviews-get:${ip}`, 120, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }
  const u = new URL(req.url);
  const listParsed = storefrontReviewsListQuerySchema.safeParse({
    productSlug: u.searchParams.get("productSlug")?.trim() || undefined,
    medusaProductId: u.searchParams.get("medusaProductId")?.trim() || undefined,
    cursor: u.searchParams.get("cursor")?.trim() || undefined,
    limit: u.searchParams.get("limit") || undefined,
  });
  if (!listParsed.success) {
    return Response.json(
      {
        error: "Provide productSlug and/or medusaProductId",
        details: listParsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  const { productSlug = "", medusaProductId = "", cursor, limit } = listParsed.data;
  const decodedCursor = cursor ? decodeReviewCursor(cursor) : null;
  if (cursor && !decodedCursor) {
    return Response.json({ error: "Invalid review cursor" }, { status: 400 });
  }
  const sb = createStorefrontAnonSupabase();
  if (!sb) {
    return Response.json({ error: "Service unavailable" }, { status: 503 });
  }
  let q = sb
    .from("product_reviews")
    .select(PUBLIC_REVIEW_FIELDS)
    .eq("status", "approved")
    .eq("shadow_banned", false)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (decodedCursor?.id) {
    q = q.or(
      `created_at.lt.${decodedCursor.createdAt},and(created_at.eq.${decodedCursor.createdAt},id.lt.${decodedCursor.id})`,
    );
  } else if (decodedCursor) {
    q = q.lt("created_at", decodedCursor.createdAt);
  }
  // The Medusa product ID is the canonical identity. Do not interpolate the
  // editorial slug into a PostgREST expression; slugs are display metadata.
  if (medusaProductId) {
    q = q.eq("medusa_product_id", medusaProductId);
  } else {
    q = q.eq("product_slug", productSlug);
  }
  const { data, error } = await q;
  if (error) {
    return Response.json({ error: "Unable to load reviews" }, { status: 503 });
  }
  const rows = data ?? [];
  const seen = new Set<string>();
  const deduped = rows.filter((r) => {
    const id = String((r as { id?: string }).id ?? "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const last = rows.at(-1) as { created_at?: unknown; id?: unknown } | undefined;
  const nextCursor =
    rows.length === limit && typeof last?.created_at === "string" && typeof last.id === "string"
      ? encodeReviewCursor(last.created_at, last.id)
      : null;
  return Response.json(
    { reviews: deduped, nextCursor },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}

function displayNameFromSession(params: {
  name?: string | null;
  email: string;
}): string {
  const n = params.name?.trim();
  if (n && n.length > 0) return n.slice(0, 120);
  const local = params.email.split("@")[0]?.trim() ?? "Customer";
  return local.slice(0, 120) || "Customer";
}

async function handlePOST(req: Request) {
  if (!isSameOriginMutation(req)) {
    return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`reviews-post:${ip}`, 15, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const session = await getStorefrontSession();
  const emailRaw = session?.user?.email?.trim();
  if (!emailRaw) {
    return Response.json(
      { error: "Sign in required to submit a review", code: "AUTH_REQUIRED" },
      { status: 401 },
    );
  }
  const email = emailRaw.toLowerCase();
  const userRl = await rateLimitFixedWindow(`reviews-post-user:${email}`, 5, 10 * 60_000);
  if (!userRl.ok) {
    return Response.json({ error: "You have submitted too many reviews recently.", retryAfter: userRl.retryAfterSec }, { status: 429 });
  }

  const bounded = await parseBoundedJson(req, MAX_REVIEW_BODY_BYTES);
  if (bounded.tooLarge) {
    return Response.json({ error: "Request body too large" }, { status: 413 });
  }
  const body: unknown = bounded.valid ? bounded.value : null;
  if (!bounded.valid) return Response.json({ error: "Invalid JSON" }, { status: 400 });
  if (!isRecaptchaConfigured()) {
    return Response.json({ error: "Security verification unavailable" }, { status: 503 });
  }
  const recaptchaToken =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).recaptchaToken
      : undefined;
  if (!(await verifyRecaptchaAction(req, recaptchaToken, "review"))) {
    return Response.json({ error: "Verification failed" }, { status: 400 });
  }
  const postParsed = storefrontReviewPostBodySchema.safeParse(body);
  if (!postParsed.success) {
    return Response.json(
      { error: "Invalid review payload", details: postParsed.error.flatten() },
      { status: 400 },
    );
  }
  const o = postParsed.data;
  if (o._hp.trim()) return Response.json({ error: "Unable to submit review" }, { status: 400 });
  if (!reviewFormTimingIsValid(o.formStartedAt)) return Response.json({ error: "Please take a moment to complete your review." }, { status: 400 });
  const csrfCookie = req.headers.get("cookie")?.match(new RegExp(`${reviewCsrfCookieName()}=([^;]+)`))?.[1];
  if (!verifyReviewCsrfToken(o.csrfToken, csrfCookie)) return Response.json({ error: "Security token expired. Reload and try again." }, { status: 403 });
  const content = validateReviewBody(o.body);
  if (!content.ok) return Response.json({ error: content.reason }, { status: 400 });

  const productSlug = o.productSlug;
  const medusaProductId = o.medusaProductId;
  const rating = o.rating;

  const customerId = await findOrCreateMedusaCustomerIdByEmail(email);
  if (!customerId) {
    return Response.json(
      { error: "Unable to resolve customer for your account" },
      { status: 502 },
    );
  }

  const verified = await findVerifiedProductPurchaseForCustomer(
    customerId,
    medusaProductId,
  );

  const authorName = displayNameFromSession({
    name: session?.user?.name,
    email,
  });

  const sb = createStorefrontServiceSupabase();
  if (!sb) {
    return Response.json(
      { error: "Reviews submission is not configured" },
      { status: 503 },
    );
  }

  const { data: duplicate } = await sb
    .from("product_reviews")
    .select("id")
    .eq("body_hash", reviewBodyHash(content.normalized))
    .in("status", ["pending", "approved", "hidden"])
    .limit(1)
    .maybeSingle();
  if (duplicate) return Response.json({ error: "An identical review has already been submitted.", code: "DUPLICATE_REVIEW" }, { status: 409 });

  const insertRow = {
    product_slug: productSlug,
    medusa_product_id: medusaProductId,
    rating,
    author_name: authorName,
    image_url:
      typeof o.proofMediaUrl === "string"
        ? o.proofMediaUrl.trim() || null
        : typeof o.imageUrl === "string"
          ? o.imageUrl.trim() || null
          : null,
    body: content.cleaned,
    body_hash: content.hash,
    risk_score: verified.verified ? 0 : 20,
    shadow_banned: false,
    status: "pending" as const,
    medusa_customer_id: customerId,
    customer_email: email,
    is_verified_buyer: verified.verified,
    verified_medusa_order_id: verified.verified ? verified.orderId : null,
    verified_at: verified.verified ? new Date().toISOString() : null,
  };

  const { error } = await sb.from("product_reviews").insert(insertRow);
  if (error) {
    const code = (error as { code?: string }).code;
    const msg = error.message ?? "";
    if (
      code === "23505" ||
      msg.includes("duplicate") ||
      msg.includes("unique") ||
      msg.includes("idx_product_reviews_one_active")
    ) {
      return Response.json(
        {
          error:
            "You already have a review for this product. Remove or wait for moderation on the existing one.",
          code: "DUPLICATE_REVIEW",
        },
        { status: 409 },
      );
    }
    return Response.json({ error: "Unable to save review" }, { status: 503 });
  }

  return Response.json({
    ok: true,
    status: "pending",
    isVerifiedBuyer: verified.verified,
  });
}

export const POST = withBotIdProtection(handlePOST);
