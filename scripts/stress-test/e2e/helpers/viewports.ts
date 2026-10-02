import type { Page } from "@playwright/test";

export const VIEWPORTS = {
  microMobile: { width: 240, height: 480 },
  smallMobile: { width: 320, height: 568 },
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  laptop: { width: 1024, height: 768 },
  desktop: { width: 1280, height: 800 },
  largeDesktop: { width: 1440, height: 900 },
  ultraWide: { width: 1920, height: 1080 },
  cinema: { width: 2560, height: 1440 },
  ultraWideShort: { width: 3440, height: 900 },
} as const;

/**
 * Width bands are intentionally explicit rather than inferred from a handful
 * of device presets. The base CSS contract begins at 0px; these named ranges
 * describe the composition transitions tested at representative widths.
 */
export const RESPONSIVE_BANDS = [
  { name: "zeroTo379", min: 0, max: 379, representative: "microMobile" },
  { name: "phone", min: 380, max: 639, representative: "mobile" },
  { name: "tablet", min: 640, max: 1023, representative: "tablet" },
  { name: "laptop", min: 1024, max: 1279, representative: "laptop" },
  { name: "desktop", min: 1280, max: 1535, representative: "desktop" },
  { name: "wide", min: 1536, max: 1919, representative: "largeDesktop" },
  { name: "ultra", min: 1920, max: 2559, representative: "ultraWide" },
  // Use the 3440px ultrawide representative for the open-ended desktop band;
  // 2560px remains covered by the viewport catalog and the admin matrix.
  { name: "cinema", min: 2560, max: Number.POSITIVE_INFINITY, representative: "ultraWideShort" },
] as const;

export async function setViewport(
  page: Page,
  key: keyof typeof VIEWPORTS,
): Promise<void> {
  const v = VIEWPORTS[key];
  await page.setViewportSize(v);
}
