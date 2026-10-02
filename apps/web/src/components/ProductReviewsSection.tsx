"use client";

import { useMemo, useState } from "react";
import type { ProductReviewRow } from "@/lib/product-reviews";
import { ProductReviewForm } from "@/components/ProductReviewForm";
import { ProductReviewsFeedClient } from "@/components/ProductReviewsFeedClient";
import { StarRatingDisplay } from "@/components/ReviewStarRatingDisplay";
import { RecaptchaScript } from "@/components/RecaptchaScript";

function RatingHistogram({
  reviews,
  total,
}: {
  reviews: ProductReviewRow[];
  total: number;
}) {
  return (
    <div
      className="flex flex-col gap-1.5"
      aria-label="Rating distribution"
      role="img"
    >
      {[5, 4, 3, 2, 1].map((star) => {
        const n = reviews.filter((r) => r.rating === star).length;
        const pct = total > 0 ? Math.round((n / total) * 100) : 0;
        return (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="w-10 shrink-0 text-right text-on-surface-variant">
              {star} star
            </span>
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-outline-variant/20"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 shrink-0 tabular-nums text-on-surface-variant">
              {n}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ProductReviewsSection({
  productSlug,
  medusaProductId,
  reviews,
}: {
  productSlug: string;
  medusaProductId: string;
  reviews: ProductReviewRow[];
}) {
  const [additionalReviews, setAdditionalReviews] = useState<ProductReviewRow[]>([]);
  const allReviews = useMemo(() => {
    const seen = new Set(reviews.map((review) => review.id));
    return [...reviews, ...additionalReviews.filter((review) => !seen.has(review.id))];
  }, [additionalReviews, reviews]);
  const count = allReviews.length;
  const average =
    count > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / count
      : 0;
  const recommendationRate = count > 0
    ? Math.round((allReviews.filter((review) => review.rating >= 4).length / count) * 100)
    : 0;

  return (
    <section
      id="reviews"
      className="mt-16 border-t border-outline-variant/20 pt-12 sm:pt-16"
      aria-labelledby="reviews-heading"
    >
      <RecaptchaScript />
      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest/60 p-6 shadow-sm sm:p-8 md:p-10 dark:bg-surface-container-lowest/30">
        {count > 0 ? (
          <div className="mb-8 flex flex-col gap-6 border-b border-outline-variant/15 pb-8 sm:mb-10 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="reviews-heading" className="font-headline text-xl font-bold uppercase tracking-wider text-primary sm:text-2xl">Reviews</h2>
              <p className="mt-2 text-sm text-on-surface-variant">{count === 1 ? "1 review" : `${count} reviews`}</p>
              <p className="mt-4 text-sm text-on-surface-variant"><span className="rounded-full bg-primary px-2 py-1 text-xs font-semibold text-on-primary">{recommendationRate}%</span> of reviewers would recommend this product</p>
            </div>
            <div className="flex flex-col gap-4 sm:items-end">
              <div className="flex flex-wrap items-center gap-3"><span className="font-headline text-3xl font-bold tabular-nums text-primary sm:text-4xl">{average.toFixed(1)}</span><div className="flex flex-col gap-1"><StarRatingDisplay value={average} size="md" /><span className="text-xs text-on-surface-variant">out of 5</span></div></div>
              <RatingHistogram reviews={allReviews} total={count} />
            </div>
          </div>
        ) : null}

        <ProductReviewsFeedClient
          reviews={reviews}
          productSlug={productSlug}
          medusaProductId={medusaProductId}
          onReviewsChange={(nextReviews) => {
            setAdditionalReviews(nextReviews.filter((review) => !reviews.some((initial) => initial.id === review.id)));
          }}
        />

        <div id="write-review" className="scroll-mt-24">
          <ProductReviewForm
            productSlug={productSlug}
            medusaProductId={medusaProductId}
          />
        </div>
      </div>
    </section>
  );
}
