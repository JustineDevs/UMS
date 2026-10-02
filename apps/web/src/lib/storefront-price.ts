/** Convert a catalog amount in centavos to the peso amount shown to shoppers. */
export function catalogAmountToStorefrontPrice(amount: number): number {
  return Math.round(amount) / 100;
}
