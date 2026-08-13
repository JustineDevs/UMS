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
export function computeDisplayVat(subtotal) {
    return Math.round(subtotal * PH_VAT_RATE * 100) / 100;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGgtdGF4LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicGgtdGF4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7O0dBYUc7QUFDSCxNQUFNLENBQUMsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDO0FBRWhDLE1BQU0sQ0FBQyxNQUFNLGNBQWMsR0FBRyxXQUFXLEdBQUcsR0FBRyxDQUFDO0FBRWhELE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxRQUFnQjtJQUNoRCxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLFdBQVcsR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFDeEQsQ0FBQyJ9