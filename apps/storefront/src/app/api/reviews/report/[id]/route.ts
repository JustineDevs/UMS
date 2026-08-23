import { getStorefrontSession } from "@/lib/auth";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { isSameOriginMutation } from "@/lib/request-origin";
import { isReviewId, reviewReportBodySchema } from "@/lib/review-api-contract";
import { readBoundedRequestBody } from "@/lib/bounded-request-body";
import { reviewCsrfCookieName, verifyReviewCsrfToken } from "@/lib/review-csrf";

const MAX_REPORT_BODY_BYTES = 8 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(req)) {
    return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`review-report:${ip}`, 10, 60_000);
  if (!rl.ok) return Response.json({ error: "Too many requests" }, { status: 429 });
  const id = (await params).id?.trim();
  const session = await getStorefrontSession();
  if (!id || !session?.user?.email) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!isReviewId(id)) {
    return Response.json({ error: "Invalid review" }, { status: 400 });
  }
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REPORT_BODY_BYTES) {
    return Response.json({ error: "Request body too large" }, { status: 413 });
  }
  const { body: rawBody, tooLarge } = await readBoundedRequestBody(req, MAX_REPORT_BODY_BYTES);
  if (tooLarge) {
    return Response.json({ error: "Request body too large" }, { status: 413 });
  }
  let body: unknown = null;
  try {
    body = JSON.parse(rawBody || "null");
  } catch {
    body = null;
  }
  const parsed = reviewReportBodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid report" }, { status: 400 });
  const csrfCookie = req.headers.get("cookie")?.match(new RegExp(`${reviewCsrfCookieName()}=([^;]+)`))?.[1];
  if (!verifyReviewCsrfToken(parsed.data.csrfToken, csrfCookie)) {
    return Response.json({ error: "Security token expired. Reload and try again." }, { status: 403 });
  }
  const sb = createStorefrontServiceSupabase();
  if (!sb) return Response.json({ error: "Service unavailable" }, { status: 503 });
  const { data: review } = await sb
    .from("product_reviews")
    .select("id")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();
  if (!review) return Response.json({ error: "Review not found" }, { status: 404 });
  const { error } = await sb.from("product_review_reports").insert({
    review_id: id,
    reporter_email: session.user.email.trim().toLowerCase(),
    reporter_ip: ip,
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") return Response.json({ error: "Already reported" }, { status: 409 });
    return Response.json({ error: "Unable to record report" }, { status: 503 });
  }
  const { count } = await sb.from("product_review_reports").select("id", { count: "exact", head: true }).eq("review_id", id).eq("status", "open");
  if ((count ?? 0) >= 3) await sb.from("product_reviews").update({ status: "hidden" }).eq("id", id).eq("status", "approved");
  return Response.json({ ok: true });
}
