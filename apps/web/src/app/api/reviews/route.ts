import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import { verifyBotIdProtection } from "@/lib/botid-protection";
import {
  isRecaptchaConfigured,
  verifyRecaptchaAction,
} from "@/lib/recaptcha-enterprise";
import { storefrontReviewPostBodySchema } from "@universal-music-store/validation";
import {
  reviewFormTimingIsValid,
  validateReviewBody,
} from "@/lib/review-content";
import { reviewCsrfCookieName, verifyReviewCsrfToken } from "@/lib/review-csrf";
import { isSameOriginMutation } from "@/lib/request-origin";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { storefrontReviewCreateResponseSchema, storefrontReviewsResponseSchema } from "@/lib/admin-api-contracts";

const MAX_REVIEW_BODY_BYTES = 16 * 1024;
const MAX_REVIEW_RESPONSE_BYTES = 2 * 1024 * 1024;

async function readBoundedResponseText(response: Response): Promise<string | null> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_REVIEW_RESPONSE_BYTES) return null;
  if (!response.body) {
    const text = await response.text();
    return text.length <= MAX_REVIEW_RESPONSE_BYTES ? text : null;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REVIEW_RESPONSE_BYTES) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  return text + decoder.decode();
}

function upstreamReviewFailure(status: number) {
  return reviewError({ error: status >= 500 ? "Review service is temporarily unavailable" : "Review request was rejected", code: status >= 500 ? "WORKER_REVIEWS_UNAVAILABLE" : "REVIEW_REQUEST_REJECTED" }, status >= 500 ? 503 : status);
}

function reviewError(
  body: Record<string, unknown>,
  status: number,
  headers?: Record<string, string>,
) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export async function GET(req: Request) {
  const apiUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!apiUrl)
    return reviewError(
      {
        error: "Review service is not configured",
        code: "WORKER_API_URL_MISSING",
      },
      503,
    );
  try {
    const upstream = await fetch(
      `${apiUrl}/store/reviews${new URL(req.url).search}`,
      { cache: "no-store" },
    );
    const text = await readBoundedResponseText(upstream);
    if (!upstream.ok || text == null) return upstreamReviewFailure(upstream.status);
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { return upstreamReviewFailure(503); }
    const parsed = storefrontReviewsResponseSchema.safeParse(payload);
    if (!parsed.success) return upstreamReviewFailure(503);
    return Response.json(parsed.data, { headers: { "Cache-Control": upstream.headers.get("Cache-Control") || "no-store" } });
  } catch {
    return reviewError(
      {
        error: "Review service is temporarily unavailable",
        code: "WORKER_REVIEWS_UNAVAILABLE",
      },
      503,
    );
  }
}

function displayNameFromUser(params: {
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
    return reviewError({ error: "Cross-site mutation rejected" }, 403);
  }
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`reviews-post:${ip}`, 15, 60_000);
  if (!rl.ok) {
    return reviewError(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      429,
      { "Retry-After": String(rl.retryAfterSec) },
    );
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: userData }, { data: auth }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  const emailRaw = userData.user?.email?.trim();
  if (!emailRaw) {
    return reviewError(
      { error: "Sign in required to submit a review", code: "AUTH_REQUIRED" },
      401,
    );
  }
  const botProtectionFailure = await verifyBotIdProtection();
  if (botProtectionFailure) return botProtectionFailure;
  const email = emailRaw.toLowerCase();
  const userRl = await rateLimitFixedWindow(
    `reviews-post-user:${email}`,
    5,
    10 * 60_000,
  );
  if (!userRl.ok) {
    return reviewError(
      {
        error: "You have submitted too many reviews recently.",
        retryAfter: userRl.retryAfterSec,
      },
      429,
    );
  }

  const bounded = await parseBoundedJson(req, MAX_REVIEW_BODY_BYTES);
  if (bounded.tooLarge) {
    return reviewError({ error: "Request body too large" }, 413);
  }
  const body: unknown = bounded.valid ? bounded.value : null;
  if (!bounded.valid) return reviewError({ error: "Invalid JSON" }, 400);
  if (!isRecaptchaConfigured()) {
    return reviewError({ error: "Security verification unavailable" }, 503);
  }
  const recaptchaToken =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).recaptchaToken
      : undefined;
  if (!(await verifyRecaptchaAction(req, recaptchaToken, "review"))) {
    return reviewError({ error: "Verification failed" }, 400);
  }
  const postParsed = storefrontReviewPostBodySchema.safeParse(body);
  if (!postParsed.success) {
    return reviewError({ error: "Invalid review payload" }, 400);
  }
  const o = postParsed.data;
  if (o._hp.trim())
    return reviewError({ error: "Unable to submit review" }, 400);
  if (!reviewFormTimingIsValid(o.formStartedAt))
    return reviewError(
      { error: "Please take a moment to complete your review." },
      400,
    );
  const csrfCookie = req.headers
    .get("cookie")
    ?.match(new RegExp(`${reviewCsrfCookieName()}=([^;]+)`))?.[1];
  if (!verifyReviewCsrfToken(o.csrfToken, csrfCookie))
    return reviewError(
      { error: "Security token expired. Reload and try again." },
      403,
    );
  const content = validateReviewBody(o.body);
  if (!content.ok) return reviewError({ error: content.reason }, 400);

  const productSlug = o.productSlug;
  const medusaProductId = o.medusaProductId;
  const rating = o.rating;

  const metadata = userData.user?.user_metadata as Record<string, unknown> | undefined;
  const authorName = displayNameFromUser({
    name:
      typeof metadata?.full_name === "string"
        ? metadata.full_name
        : typeof metadata?.name === "string"
          ? metadata.name
          : null,
    email,
  });
  const apiUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!apiUrl)
    return reviewError(
      {
        error: "Review service is not configured",
        code: "WORKER_API_URL_MISSING",
      },
      503,
    );
  const accessToken = auth.session?.access_token?.trim();
  if (!accessToken)
    return reviewError(
      { error: "Sign in required to submit a review", code: "AUTH_REQUIRED" },
      401,
    );
  try {
    const upstream = await fetch(`${apiUrl}/store/reviews`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        productSlug,
        medusaProductId,
        rating,
        body: content.cleaned,
        authorName,
        imageUrl:
          typeof o.proofMediaUrl === "string"
            ? o.proofMediaUrl.trim()
            : typeof o.imageUrl === "string"
              ? o.imageUrl.trim()
              : null,
      }),
      cache: "no-store",
    });
    const text = await readBoundedResponseText(upstream);
    if (!upstream.ok || text == null) return upstreamReviewFailure(upstream.status);
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { return upstreamReviewFailure(503); }
    const parsed = storefrontReviewCreateResponseSchema.safeParse(payload);
    if (!parsed.success) return upstreamReviewFailure(503);
    return Response.json(parsed.data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return reviewError(
      {
        error: "Review service is temporarily unavailable",
        code: "WORKER_REVIEWS_UNAVAILABLE",
      },
      503,
    );
  }
}

export const POST = handlePOST;
