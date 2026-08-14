/**
 * Philippine VAT rate applied to all taxable goods.
 *
 * TAX DISPLAY-ONLY NOTICE:
 * Tax amounts shown on the storefront checkout and POS terminal
 * are client-side estimates for informational display. The
 * authoritative tax calculation happens inside Medusa during
 * order finalization. Display values exist to set customer
 * expectations and will match Medusa-computed totals under
 * standard scenarios (single region, uniform VAT).
 *
 * If tax rules change or region-specific rates are needed,
 * update this constant and the matching Medusa tax configuration.
 */
export const PH_VAT_RATE = 0.12;

export const PH_VAT_PERCENT = PH_VAT_RATE * 100;

export function computeDisplayVat(subtotal: number): number {
  return Math.round(subtotal * PH_VAT_RATE * 100) / 100;
}
