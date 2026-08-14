/**
 * Medusa v2 store and admin APIs expose monetary amounts as integers in the
 * smallest currency unit (same as Stripe: centavos for PHP, yen for JPY).
 *
 * Staging check: compare cart.total from GET /store/carts/:id to the PSP
 * checkout amount; they must match after applying minorUnitDivisor(currency).
 */

/** ISO 4217 minor units for common storefront currencies (default 2). */
const MINOR_UNITS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  BHD: 3,
  JOD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
};

export function minorUnitDivisor(currencyCode: string): number {
  const n = MINOR_UNITS[currencyCode.trim().toUpperCase()];
  if (n === 0) return 1;
  if (typeof n === "number" && n > 0) return 10 ** n;
  return 100;
}

/**
 * Converts Medusa integer total (smallest currency unit) to major units for UI.
 */
export function medusaMinorToMajor(totalMinor: number, currencyCode: string): number {
  const div = minorUnitDivisor(currencyCode);
  const major = totalMinor / div;
  return Math.round(major * 1e6) / 1e6;
}
