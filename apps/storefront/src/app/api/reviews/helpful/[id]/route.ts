import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  createStorefrontServiceSupabase,
} from "@/lib/storefront-supabase";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import { findOrCreateMedusaCustomerIdByEmail } from "@/lib/medusa-customer-resolve";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`review-helpful:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { id: reviewId } = await params;
  if (!reviewId?.trim()) {
    return Response.json({ error: "Missing review id" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();

  const sb = createStorefrontServiceSupabase();
  if (!sb) {
    return Response.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: review } = await sb
    .from("product_reviews")
    .select("id,helpful_votes")
    .eq("id", reviewId)
    .eq("status", "approved")
    .maybeSingle();

  if (!review) {
    return Response.json({ error: "Review not found" }, { status: 404 });
  }

  let customerId: string | null = null;
  if (email) {
    customerId = await findOrCreateMedusaCustomerIdByEmail(email).catch(() => null);
  }

  const voteRow: Record<string, string> = {
    review_id: reviewId,
    voter_ip: ip,
  };
  if (customerId) {
    voteRow.medusa_customer_id = customerId;
  }

  const { error: insertErr } = await sb
    .from("review_helpful_votes")
    .insert(voteRow);

  if (insertErr) {
    const code = (insertErr as { code?: string }).code;
    if (code === "23505") {
      return Response.json(
        { error: "Already voted", code: "ALREADY_VOTED" },
        { status: 409 },
      );
    }
    return Response.json({ error: "Unable to record vote" }, { status: 500 });
  }

  const newVotes = Number(review.helpful_votes ?? 0) + 1;
  await sb
    .from("product_reviews")
    .update({ helpful_votes: newVotes })
    .eq("id", reviewId);

  return Response.json({ ok: true, helpful_votes: newVotes });
}
