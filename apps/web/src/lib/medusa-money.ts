/**
 * Medusa v2 store and admin APIs expose monetary amounts as integers in the
 * smallest currency unit (same as Stripe: centavos for PHP, yen for JPY).
 *
 * Staging check: compare cart.total from GET /store/carts/:id to the PSP
 * checkout amount; they must match after applying minorUnitDivisor(currency).
 */

import { minorToMajor, minorUnitDivisor } from "@universal-music-store/sdk/multi-region";

export { minorUnitDivisor };

/**
 * Converts Medusa integer total (smallest currency unit) to major units for UI.
 */
export function medusaMinorToMajor(totalMinor: number, currencyCode: string): number {
  const major = minorToMajor(totalMinor, currencyCode);
  return Math.round(major * 1e6) / 1e6;
}
