import type { Page } from "@playwright/test";

export const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
  ultraWide: { width: 1920, height: 1080 },
} as const;

export async function setViewport(
  page: Page,
  key: keyof typeof VIEWPORTS,
): Promise<void> {
  const v = VIEWPORTS[key];
  await page.setViewportSize(v);
}
