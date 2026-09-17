"use client";

import type { StorefrontCatalogMutationClassification } from "@/lib/storefront-commerce-invalidation";

type Props = {
  /** Last classification returned after a successful PATCH, if any. */
  lastClassification: StorefrontCatalogMutationClassification | null;
};

export function CatalogMutationImpactPanel({ lastClassification }: Props) {
  return (
    <div
      className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-200"
      role="region"
      aria-label="Storefront impact of catalog saves"
    >
      <p className="font-medium text-neutral-900 dark:text-neutral-100">
        How saves affect the storefront
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-700 dark:text-neutral-300">
        <li>
          <strong>Checkout-affecting</strong> changes (sell price) refresh listings
          and open checkouts may need a fresh review of totals.
        </li>
        <li>
          <strong>Sellability-affecting</strong> changes (stock, publish/draft,
          categories, variant matrix) refresh listings and matching open payment
          sessions are marked for review.
        </li>
        <li>
          <strong>Merchandising-only</strong> updates (compare-at, badges, SEO
          metadata) refresh pages without invalidating active payment sessions for
          quote totals.
        </li>
        <li>
          <strong>Editorial-only</strong> updates (title, description, hero
          imagery) refresh product content without resetting checkout payment
          rows tied to this product.
        </li>
      </ul>
      {lastClassification ? (
        <p className="mt-3 border-t border-neutral-200 pt-3 text-neutral-800 dark:border-neutral-600 dark:text-neutral-100">
          Last save classified as:{" "}
          <span className="font-mono text-xs">{lastClassification}</span>
        </p>
      ) : null}
    </div>
  );
}
