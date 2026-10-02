const PROFILE_REQUIRED_PREFIXES = ["/account", "/checkout", "/wishlist"];
const PROFILE_EXEMPT_CHECKOUT_ROUTES = new Set(["/checkout/hosted-return", "/checkout/stripe-return"]);

export function isExplicitGuestCheckout(pathname: string, search: string): boolean {
  return pathname === "/checkout" && new URLSearchParams(search).get("guest") === "1";
}

export function requiresStorefrontOnboarding(pathname: string): boolean {
  if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname.includes(".")) return false;
  if (PROFILE_EXEMPT_CHECKOUT_ROUTES.has(pathname)) return false;
  return PROFILE_REQUIRED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
