"use client";

import { useCallback, useMemo, useState } from "react";
import { inferReviewProofMedia } from "@universal-music-store/types";
import type { ProductReviewRow } from "@/lib/product-reviews";
import { encodeReviewCursor } from "@/lib/review-api-contract";
import { StarRatingDisplay } from "@/components/ReviewStarRatingDisplay";

type SortKey = "newest" | "oldest" | "highest" | "lowest" | "helpful";

function HelpfulButton({
  reviewId,
  initialVotes,
}: {
  reviewId: string;
  initialVotes: number;
}) {
  const [votes, setVotes] = useState(initialVotes);
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleVote = useCallback(async () => {
    if (voted || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/helpful/${encodeURIComponent(reviewId)}`, {
        method: "POST",
      });
      if (res.ok) {
        setVotes((v) => v + 1);
        setVoted(true);
      }
    } finally {
      setLoading(false);
    }
  }, [reviewId, voted, loading]);

  return (
    <button
      type="button"
      onClick={handleVote}
      disabled={voted || loading}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        voted
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-outline-variant/30 bg-transparent text-on-surface-variant hover:border-outline-variant hover:text-on-surface"
      } disabled:cursor-not-allowed disabled:opacity-60`}
      aria-label={voted ? "Marked as helpful" : "Mark review as helpful"}
      aria-pressed={voted}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill={voted ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
        <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
      </svg>
      Helpful {votes > 0 ? `(${votes})` : ""}
    </button>
  );
}

function ReportButton({ reviewId }: { reviewId: string }) {
  const [reason, setReason] = useState("spam");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function report() {
    setState("sending");
    try {
      const csrfResponse = await fetch("/api/reviews/csrf", { credentials: "same-origin" });
      const csrfBody = (await csrfResponse.json()) as { token?: string };
      if (!csrfResponse.ok || !csrfBody.token) {
        setState("error");
        return;
      }
      const res = await fetch(`/api/reviews/report/${encodeURIComponent(reviewId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reason, csrfToken: csrfBody.token }),
      });
      setState(res.ok || res.status === 409 ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return <span className="text-xs text-on-surface-variant">Report received</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`report-reason-${reviewId}`}>Report reason</label>
      <select
        id={`report-reason-${reviewId}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={state === "sending"}
        className="min-h-11 rounded-lg border border-outline-variant/30 bg-transparent px-2 py-1.5 text-xs text-on-surface-variant"
      >
        <option value="spam">Spam</option>
        <option value="harassment">Harassment</option>
        <option value="hate">Hate speech</option>
        <option value="personal_data">Personal data</option>
        <option value="other">Other</option>
      </select>
      <button
        type="button"
        onClick={() => void report()}
        disabled={state === "sending"}
        className="min-h-11 rounded-lg px-2 text-xs text-on-surface-variant underline-offset-2 hover:underline disabled:opacity-50"
      >
        {state === "sending" ? "Reporting…" : "Report"}
      </button>
      {state === "error" ? (
        <span className="text-xs text-red-700 dark:text-red-300" role="alert">
          Sign in and try again, or contact support if reporting remains unavailable.
        </span>
      ) : null}
    </div>
  );
}

export function ProductReviewsFeedClient({
  reviews,
  productSlug,
  medusaProductId,
  onReviewsChange,
}: {
  reviews: ProductReviewRow[];
  productSlug: string;
  medusaProductId: string;
  onReviewsChange?: (reviews: ProductReviewRow[]) => void;
}) {
  const [allReviews, setAllReviews] = useState(reviews);
  const [nextCursor, setNextCursor] = useState(
    reviews.length >= 50
      ? (() => {
          const last = reviews.at(-1);
          return last ? encodeReviewCursor(last.created_at, last.id) : null;
        })()
      : null,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");
  const [sort, setSort] = useState<SortKey>("newest");

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams({
        productSlug,
        medusaProductId,
        cursor: nextCursor,
        limit: "50",
      });
      const response = await fetch(`/api/reviews?${params.toString()}`, {
        // The API supplies a short public cache window for anonymous review reads.
        credentials: "same-origin",
      });
      if (!response.ok) {
        setLoadError(true);
        return;
      }
      const body = (await response.json()) as {
        reviews?: ProductReviewRow[];
        nextCursor?: string | null;
      };
      const existing = new Set(allReviews.map((review) => review.id));
      const additions = (body.reviews ?? []).filter((review) => {
        if (!review.id || existing.has(review.id)) return false;
        existing.add(review.id);
        return true;
      });
      setAllReviews((current) => [...current, ...additions]);
      onReviewsChange?.([...allReviews, ...additions]);
      setNextCursor(body.nextCursor ?? null);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  const filtered = useMemo(() => {
    let r = [...allReviews];
    if (ratingFilter !== "all") {
      r = r.filter((x) => x.rating === ratingFilter);
    }
    r.sort((a, b) => {
      if (sort === "helpful") {
        return (b.helpful_votes ?? 0) - (a.helpful_votes ?? 0);
      }
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      if (sort === "newest") return tb - ta;
      if (sort === "oldest") return ta - tb;
      if (sort === "highest") return b.rating - a.rating;
      return a.rating - b.rating;
    });
    return r;
  }, [allReviews, ratingFilter, sort]);

  if (allReviews.length === 0) return null;

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Filter by stars
          <select
            className="max-w-[200px] rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm font-normal normal-case text-on-surface"
            value={ratingFilter === "all" ? "all" : String(ratingFilter)}
            onChange={(e) => {
              const v = e.target.value;
              setRatingFilter(v === "all" ? "all" : Number(v));
            }}
          >
            <option value="all">All ratings</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} stars
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Sort
          <select
            className="max-w-[220px] rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm font-normal normal-case text-on-surface"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest">Highest rating</option>
            <option value="lowest">Lowest rating</option>
            <option value="helpful">Most helpful</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="mb-10 text-sm text-on-surface-variant">
          No reviews match this filter. Try another star rating.
        </p>
      ) : (
        <ul className="mb-10 space-y-4 sm:space-y-5">
          {filtered.map((r) => (
            <li key={r.id}>
              <article className="rounded-xl border border-outline-variant/15 bg-surface/40 px-5 py-5 sm:px-6 dark:bg-surface/25">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-primary">{r.author_name}</p>
                      {r.is_verified_buyer ? (
                        <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-900 dark:text-emerald-100">
                          Verified buyer
                        </span>
                      ) : null}
                    </div>
                    <StarRatingDisplay
                      value={r.rating}
                      size="sm"
                      className="mt-1.5"
                    />
                  </div>
                  <time
                    className="shrink-0 text-xs text-on-surface-variant sm:pt-0.5"
                    dateTime={r.created_at}
                  >
                    {new Date(r.created_at).toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
                  {r.body}
                </p>
                {r.imageUrl ? (() => {
                  const media = inferReviewProofMedia(r.imageUrl);
                  if (!media) {
                    return null;
                  }
                  if (media.kind === "image") {
                    return (
                      <a
                        href={media.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 block overflow-hidden rounded-xl border border-outline-variant/15"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- customer-proof URLs are arbitrary and not in Next image remotePatterns */}
                        <img
                          src={media.url}
                          alt=""
                          className="h-auto w-full object-cover"
                        />
                      </a>
                    );
                  }
                  if (media.kind === "video") {
                    return (
                      <div className="mt-4 overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-low">
                        <video
                          controls
                          preload="metadata"
                          className="h-auto w-full bg-black object-cover"
                        >
                          <source src={media.url} />
                          Proof video attached. Open the link if your browser cannot play it.
                        </video>
                      </div>
                    );
                  }
                  return (
                    <a
                      href={media.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 block overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-low px-4 py-4 text-sm text-on-surface-variant"
                    >
                      Proof link attached. Open to review the source.
                    </a>
                  );
                })() : null}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <HelpfulButton
                    reviewId={r.id}
                    initialVotes={r.helpful_votes ?? 0}
                  />
                  <ReportButton reviewId={r.id} />
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <div className="mb-10 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="min-h-11 rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary disabled:cursor-wait disabled:opacity-60"
          >
            {loadingMore ? "Loading reviews..." : "Load more reviews"}
          </button>
          {loadError ? (
            <span role="status" className="text-sm text-error">
              Reviews could not be loaded. Try again.
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
