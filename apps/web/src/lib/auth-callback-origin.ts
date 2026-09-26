/**
 * Accept only storefront origins that are owned by this deployment.
 * Explicitly listing the dev alias prevents preview OAuth from falling back
 * to the production origin when Vercel does not preserve the forwarded host.
 */
export function isAllowedBrowserOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) return false;
    return (
      url.origin === "https://universalmusic.vercel.app" ||
      url.origin === "https://universalmusic-preview.vercel.app" ||
      url.hostname.endsWith("-justinedevs-projects.vercel.app") ||
      ["localhost", "127.0.0.1"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
