/**
 * Preset labels for Size / Color on the single-variant product form.
 * Values are sent to the store as option values (storefront filters use these names).
 * Owners can pick "Custom…" and type any label (still capped at 100 chars in mutations).
 */
export const CATALOG_SIZE_PRESETS = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXL+",
  "One Size",
  "Free Size",
  "28",
  "30",
  "32",
  "34",
  "36",
  "38",
  "40",
] as const;

export const CATALOG_COLOR_PRESETS = [
  "Default",
  "Black",
  "White",
  "Gray",
  "Charcoal",
  "Navy",
  "Royal Blue",
  "Beige",
  "Khaki",
  "Brown",
  "Cream",
  "Red",
  "Burgundy",
  "Pink",
  "Forest Green",
  "Olive",
  "Multicolor",
  "Printed",
] as const;

const CUSTOM_VARIANT_SENTINEL = "__custom__";
