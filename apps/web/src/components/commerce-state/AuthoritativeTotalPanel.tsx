"use client";

import { formatCheckoutMoney } from "@/app/(public)/checkout/checkout-utils";

type Money = { label: string; value: number; tone?: "default" | "discount" };

/**
 * Server-authoritative totals rail (PRD: AuthoritativeTotalPanel).
 * Shows the single source of truth from Medusa including shipping, tax, and discounts.
 */
export function AuthoritativeTotalPanel({
  displayCurrency,
  subtotal,
  shippingTotal,
  taxTotal,
  discountTotal,
  total,
}: {
  displayCurrency: string;
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  discountTotal: number;
  /** Final grand total from Medusa preview (single source of truth). */
  total: number;
}) {
  const componentSum = subtotal + shippingTotal + taxTotal - discountTotal;
  const taxInclusive = taxTotal > 0 && componentSum - total > 0.5;

  const rows: Money[] = [
    { label: "Subtotal", value: subtotal },
    { label: "Shipping", value: shippingTotal },
  ];
  if (taxTotal > 0) {
    rows.push({
      label: taxInclusive ? "Tax (included in subtotal)" : "Tax",
      value: taxTotal,
    });
  }
  if (discountTotal > 0) {
    rows.push({ label: "Discount", value: -discountTotal, tone: "discount" });
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block h-2 w-2 rounded-full bg-green-600" aria-hidden="true" />
        <span className="text-xs font-medium text-green-800">
          Confirmed pricing (includes shipping and taxes)
        </span>
      </div>
      {rows.map((row) => {
        const isTaxIncludedRow = row.label.includes("included");
        return (
          <div
            key={row.label}
            className={`flex justify-between text-sm ${
              row.tone === "discount"
                ? "text-green-800"
                : isTaxIncludedRow
                  ? "text-on-surface-variant/70 text-xs"
                  : ""
            }`}
          >
            <span className="text-on-surface-variant">{row.label}</span>
            <span>
              {row.tone === "discount" ? "−" : null}
              {formatCheckoutMoney(Math.abs(row.value), displayCurrency)}
            </span>
          </div>
        );
      })}
      <div className="flex justify-between font-headline font-bold text-lg pt-3 mt-1 border-t border-outline-variant/20">
        <span>You pay</span>
        <span>{formatCheckoutMoney(total, displayCurrency)}</span>
      </div>
    </>
  );
}
