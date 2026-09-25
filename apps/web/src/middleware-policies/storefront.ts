import { type NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { tryCmsRedirect } from "@/lib/cms-redirect";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { E2E_SESSION_COOKIE } from "@/lib/e2e-session-constants";

async function updateSupabaseSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request: { headers: request.headers } });
  if (
    process.env.UVS_E2E_REAL_SESSION === "1" &&
    process.env.VERCEL !== "1" &&
    (process.env.UVS_E2E_LOCAL === "1" || process.env.NODE_ENV === "development") &&
    request.cookies.has(E2E_SESSION_COOKIE)
  ) return response;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (request.nextUrl.pathname.startsWith("/account")) {
    if (!data.user) {
      const signIn = request.nextUrl.clone();
      signIn.pathname = "/sign-in";
      signIn.searchParams.set("callbackUrl", request.nextUrl.pathname);
      return NextResponse.redirect(signIn);
    }
  }
  return response;
}

function isAuthDisabledForQa(): boolean {
  if (process.env.UVS_E2E_LOCAL === "1" && process.env.VERCEL !== "1") return true;
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
  _event: NextFetchEvent,
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

  // API route handlers perform their own session and authorization checks. Do
  // not spend a second Supabase lookup or CMS redirect query in middleware.
  if (requestWithId.nextUrl.pathname.startsWith("/api/")) {
    const apiResponse = NextResponse.next({ request: { headers: requestHeaders } });
    apiResponse.headers.set("x-request-id", requestId);
    return apiResponse;
  }

  const redirect = await tryCmsRedirect(requestWithId);
  if (redirect) {
    redirect.headers.set("x-request-id", requestId);
    return redirect;
  }

  const res = isAuthDisabledForQa() ? null : await updateSupabaseSession(requestWithId);
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
