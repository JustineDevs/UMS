/**
 * Small-format shelf / variant label (ESC/POS thermal), distinct from full receipts.
 */
export type ProductLabelPayload = {
  productName: string;
  sku: string;
  /** EAN/UPC or internal barcode digits; printed as a clear human-readable line. */
  barcode?: string;
  size?: string;
  color?: string;
  /** Pre-formatted for locale, e.g. "PHP 1,299.00" */
  priceDisplay: string;
};
