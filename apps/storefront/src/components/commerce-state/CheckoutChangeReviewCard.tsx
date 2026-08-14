"use client";

import { CheckoutReviewDiffList, type QuoteReviewLine } from "./CheckoutReviewDiffList";

/**
 * Quote review gate before payment continuation (PRD: CheckoutChangeReviewCard).
 */
export function CheckoutChangeReviewCard({
  quoteReviewRequired,
  quoteReviewAcknowledged,
  quoteReviewItems,
  onAcknowledge,
}: {
  quoteReviewRequired: boolean;
  quoteReviewAcknowledged: boolean;
  quoteReviewItems: QuoteReviewLine[];
  onAcknowledge: () => void;
}) {
  if (quoteReviewItems.length === 0) return null;

  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
        quoteReviewRequired
          ? "border-amber-300 bg-amber-50 text-amber-950"
          : "border-emerald-200 bg-emerald-50 text-emerald-950"
      }`}
      role="status"
      aria-live="polite"
    >
      <p className="font-semibold">
        {quoteReviewRequired
          ? "Your order was refreshed with the latest live pricing."
          : "You reviewed the latest live pricing for this order."}
      </p>
      <CheckoutReviewDiffList items={quoteReviewItems} />
      {quoteReviewRequired ? (
        <button
          type="button"
          onClick={onAcknowledge}
          className="mt-3 inline-flex rounded border border-amber-500 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-amber-900 transition-colors hover:bg-amber-100"
        >
          I&apos;ve reviewed the updated total
        </button>
      ) : quoteReviewAcknowledged ? (
        <p className="mt-3 text-[11px] font-medium uppercase tracking-widest text-emerald-800">
          Review confirmed
        </p>
      ) : null}
    </div>
  );
}
