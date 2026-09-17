import { NextRequest, type NextFetchEvent } from "next/server";
import adminMiddleware from "./middleware-policies/admin";
import storefrontMiddleware from "./middleware-policies/storefront";

/** One Next runtime with explicit policy seams for the Admin and Storefront audiences. */
export default function middleware(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;
  const isAdminSurface =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/guide-demos") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/integrations") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/pos") ||
    pathname.startsWith("/api/webhooks");

  return isAdminSurface
    ? adminMiddleware(request, event)
    : storefrontMiddleware(request, event);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
