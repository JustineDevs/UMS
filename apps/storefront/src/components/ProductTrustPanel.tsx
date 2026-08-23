import type { Product } from "@universal-music-store/types";

export function ProductTrustPanel({ product }: { product: Product }) {
  const trust = product.trustContent;
  if (!trust) return null;
  const rows = [
    ["Condition", trust.conditionGrade],
    ["Warranty", trust.warranty],
    ["Authenticity", trust.authenticity],
    ["Setup & inspection", trust.setupAndInspection],
    ["Shipping eligibility", trust.shippingEligibility],
    ["Returns", trust.returnNotes],
    ["Included accessories", trust.includedAccessories?.join(" · ")],
  ].filter(([, value]) => value?.trim()) as Array<[string, string]>;
  if (!rows.length) return null;
  return (
    <section className="border-y border-outline-variant/20 py-6" aria-labelledby="product-trust-title">
      <h2 id="product-trust-title" className="mb-4 text-lg font-bold">What you can count on</h2>
      <dl className="space-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[9rem_1fr] gap-4">
            <dt className="font-semibold text-on-surface-variant">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
