export function cmsPagePreviewUrl(pageUrl: string, previewToken: string | null | undefined): string {
  const token = previewToken?.trim();
  if (!token) return pageUrl;
  const url = new URL(pageUrl);
  url.searchParams.set("preview", token);
  return url.toString();
}
