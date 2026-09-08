import { type NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { tryCmsRedirect } from "@/lib/cms-redirect";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";

const authMiddleware = withAuth({
  pages: { signIn: "/sign-in" },
  callbacks: {
    authorized: ({ token, req }) => {
      const p = req.nextUrl.pathname;
      if (p.startsWith("/account")) return !!token;
      return true;
    },
  },
});

function isAuthDisabledForQa(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return [
    process.env.AUTH_DISABLED,
    process.env.AUTH_DISABLE,
    process.env.NEXT_PUBLIC_AUTH_DISABLED,
    process.env.NEXT_PUBLIC_AUTH_DISABLE,
  ].some((value) => value === "true");
}

function ensureRequestId(request: NextRequest): {
  id: string;
  requestHeaders: Headers;
} {
  const incoming =
    request.headers.get("x-request-id")?.trim() ||
    request.headers.get("x-correlation-id")?.trim();
  const id =
    incoming && incoming.length > 0 ? incoming.slice(0, 128) : crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", id);
  return { id, requestHeaders };
}

export default async function middleware(
  request: NextRequest,
  event: NextFetchEvent,
) {
  const { id: requestId, requestHeaders } = ensureRequestId(request);
  const requestWithId = new NextRequest(request, {
    headers: requestHeaders,
  });

  const maintenanceRaw =
    process.env.NEXT_PUBLIC_MAINTENANCE_MODE?.trim().toLowerCase() ?? "";
  if (maintenanceRaw === "true" || maintenanceRaw === "1") {
    const path = requestWithId.nextUrl.pathname;
    const allowed =
      path.startsWith("/maintenance") ||
      path.startsWith("/api/") ||
      path.startsWith("/_next");
    if (!allowed) {
      const u = requestWithId.nextUrl.clone();
      u.pathname = "/maintenance";
      u.search = "";
      const res = NextResponse.redirect(u);
      res.headers.set("x-request-id", requestId);
      return res;
    }
  }

  if (requestWithId.nextUrl.pathname.startsWith("/track/cap_")) {
    const rate = await rateLimitFixedWindow(
      `tracking-view:${getRequestIp(requestWithId)}`,
      60,
      60_000,
    );
    if (!rate.ok) {
      const response = NextResponse.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(rate.retryAfterSec),
          },
        },
      );
      response.headers.set("x-request-id", requestId);
      console.warn("[tracking] view_rate_limited", { status: 429 });
      return response;
    }
  }

  const redirect = await tryCmsRedirect(requestWithId);
  if (redirect) {
    redirect.headers.set("x-request-id", requestId);
    return redirect;
  }

  const res = isAuthDisabledForQa()
    ? null
    : await authMiddleware(requestWithId as NextRequestWithAuth, event);
  if (res instanceof NextResponse) {
    res.headers.set("x-request-id", requestId);
    return res;
  }
  const fallback = NextResponse.next({
    request: { headers: requestHeaders },
  });
  fallback.headers.set("x-request-id", requestId);
  return fallback;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
