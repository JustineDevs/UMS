import type { ProductReviewRow } from "@/lib/product-reviews";
import { ProductReviewForm } from "@/components/ProductReviewForm";
import { ProductReviewsFeedClient } from "@/components/ProductReviewsFeedClient";
import { StarRatingDisplay } from "@/components/ReviewStarRatingDisplay";

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
                className="h-full rounded-full bg-primary transition-all duration-300"
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
  const count = reviews.length;
  const average =
    count > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / count
      : 0;

  return (
    <section
      id="reviews"
      className="mt-16 border-t border-outline-variant/20 pt-12 sm:pt-16"
      aria-labelledby="reviews-heading"
    >
      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest/60 p-6 shadow-sm sm:p-8 md:p-10 dark:bg-surface-container-lowest/30">
        <div className="mb-8 flex flex-col gap-6 sm:mb-10 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2
              id="reviews-heading"
              className="font-headline text-xl font-bold uppercase tracking-wider text-primary sm:text-2xl"
            >
              Reviews
            </h2>
            {count > 0 ? (
              <p className="mt-2 text-sm text-on-surface-variant">
                {count === 1 ? "1 review" : `${count} reviews`}
              </p>
            ) : (
              <p className="mt-2 text-sm text-on-surface-variant">
                No reviews yet. Be the first to share your experience.
              </p>
            )}
          </div>
          {count > 0 ? (
            <div className="flex flex-col gap-4 sm:items-end">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-headline text-3xl font-bold tabular-nums text-primary sm:text-4xl">
                  {average.toFixed(1)}
                </span>
                <div className="flex flex-col gap-1">
                  <StarRatingDisplay value={average} size="md" />
                  <span className="text-xs text-on-surface-variant">out of 5</span>
                </div>
              </div>
              <div className="w-full max-w-xs">
                <RatingHistogram reviews={reviews} total={count} />
              </div>
            </div>
          ) : null}
        </div>

        <ProductReviewsFeedClient reviews={reviews} />

        <ProductReviewForm
          productSlug={productSlug}
          medusaProductId={medusaProductId}
        />
      </div>
    </section>
  );
}
