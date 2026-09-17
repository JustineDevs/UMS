import type { CartLine } from "@/lib/cart";
import type { CheckoutTotalsPreview } from "@/lib/checkout-worker";

export type CheckoutReviewItem = {
  key: string;
  tone: "info" | "warning";
  message: string;
};

function moneyDeltaExceedsTolerance(
  left: number,
  right: number,
  tolerance = 0.01,
): boolean {
  return Math.abs(left - right) > tolerance;
}

function formatReviewMoney(currencyCode: string, amount: number): string {
  return `${currencyCode} ${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function buildCheckoutReviewItems(input: {
  lines: CartLine[];
  medusaPricePreview: CheckoutTotalsPreview | null;
  localTax: number;
  localTotal: number;
}): CheckoutReviewItem[] {
  const preview = input.medusaPricePreview;
  if (!preview) return [];

  const items: CheckoutReviewItem[] = [];
  for (const line of input.lines) {
    const localSubtotal = line.price * line.quantity;
    const liveSubtotal = preview.lineSubtotalsByVariantId[line.variantId];
    if (
      liveSubtotal != null &&
      Number.isFinite(liveSubtotal) &&
      moneyDeltaExceedsTolerance(localSubtotal, liveSubtotal)
    ) {
      items.push({
        key: `line-${line.variantId}`,
        tone: "warning",
        message: `${line.name} now totals ${formatReviewMoney(preview.currencyCode, liveSubtotal)} for ${line.quantity} item${line.quantity === 1 ? "" : "s"}.`,
      });
    }
  }

  if (preview.shippingTotal > 0) {
    items.push({
      key: "shipping",
      tone: "info",
      message: `Shipping is now included at ${formatReviewMoney(preview.currencyCode, preview.shippingTotal)}.`,
    });
  }

  if (moneyDeltaExceedsTolerance(preview.taxTotal, input.localTax)) {
    items.push({
      key: "tax",
      tone: "info",
      message: `Tax was recalculated to ${formatReviewMoney(preview.currencyCode, preview.taxTotal)}.`,
    });
  }

  if (preview.discountTotal > 0) {
    items.push({
      key: "discount",
      tone: "info",
      message: `Discounts now reduce the order by ${formatReviewMoney(preview.currencyCode, preview.discountTotal)}.`,
    });
  }

  if (moneyDeltaExceedsTolerance(preview.total, input.localTotal, 0.5)) {
    items.push({
      key: "total",
      tone: "warning",
      message: `Your final total is now ${formatReviewMoney(preview.currencyCode, preview.total)}.`,
    });
  }

  return items;
}
