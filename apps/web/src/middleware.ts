import { NextRequest, type NextFetchEvent } from "next/server";
import adminMiddleware from "./middleware-policies/admin";
import storefrontMiddleware from "./middleware-policies/storefront";
import { buildRouteMetric, emitRouteMetric } from "./lib/route-observability";

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

  const family = isAdminSurface ? "admin" : "storefront";
  const started = performance.now();
  const result = isAdminSurface
    ? adminMiddleware(request, event)
    : storefrontMiddleware(request, event);
  return Promise.resolve(result).then((response) => {
    emitRouteMetric(buildRouteMetric({
      route: pathname,
      method: request.method,
      family,
      status: response.status,
      durationMs: performance.now() - started,
      requestId: response.headers.get("x-request-id") ?? request.headers.get("x-request-id") ?? "unknown",
      cache: response.headers.get("cache-control") ?? "unspecified",
    }));
    return response;
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
