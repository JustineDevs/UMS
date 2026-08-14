"use client";

export type QuoteReviewLine = { key: string; message: string };

/**
 * Line-level quote drift reasons (PRD: CheckoutReviewDiffList).
 */
export function CheckoutReviewDiffList({ items }: { items: QuoteReviewLine[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-xs leading-relaxed">
      {items.map((item) => (
        <li key={item.key}>{item.message}</li>
      ))}
    </ul>
  );
}
