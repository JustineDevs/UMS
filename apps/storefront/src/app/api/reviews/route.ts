import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
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

const PUBLIC_REVIEW_FIELDS =
  "id,rating,author_name,image_url,body,created_at,product_slug,medusa_product_id,is_verified_buyer,status";

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
  const { productSlug = "", medusaProductId = "" } = listParsed.data;
  const sb = createStorefrontAnonSupabase();
  if (!sb) {
    return Response.json({ error: "Service unavailable" }, { status: 503 });
  }
  let q = sb
    .from("product_reviews")
    .select(PUBLIC_REVIEW_FIELDS)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(50);
  if (medusaProductId && productSlug) {
    q = q.or(
      `medusa_product_id.eq.${medusaProductId},product_slug.eq.${productSlug}`,
    );
  } else if (medusaProductId) {
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
  return Response.json({ reviews: deduped });
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
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`reviews-post:${ip}`, 15, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const session = await getServerSession(authOptions);
  const emailRaw = session?.user?.email?.trim();
  if (!emailRaw) {
    return Response.json(
      { error: "Sign in required to submit a review", code: "AUTH_REQUIRED" },
      { status: 401 },
    );
  }
  const email = emailRaw.toLowerCase();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
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

  const productSlug = o.productSlug;
  const medusaProductId = o.medusaProductId;
  const reviewBody = o.body;
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
    body: reviewBody,
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
