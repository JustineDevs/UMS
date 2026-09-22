import { NextResponse } from "next/server";
import { NextRequest, type NextFetchEvent } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isEmailAllowedForGuideDemos } from "@/lib/admin-allowed-emails";
import { checkAdminRateLimit } from "@/lib/admin-rate-limit";
import { E2E_SESSION_COOKIE } from "@/lib/e2e-session-constants";

async function updateSupabaseSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request: { headers: request.headers } });
  if (process.env.NODE_ENV === "development" && process.env.UVS_E2E_REAL_SESSION === "1" && process.env.VERCEL !== "1" && request.cookies.has(E2E_SESSION_COOKIE)) return response;
  // Keep the documented local-auth development mode consistent with the page/session layer.
  // Never allow this bypass in production, even if a stale environment value is present.
  if (process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production") {
    return response;
  }
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
  if (!data.user && (request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/guide-demos"))) {
    const signIn = request.nextUrl.clone(); signIn.pathname = "/sign-in"; signIn.searchParams.set("callbackUrl", request.nextUrl.pathname); return NextResponse.redirect(signIn);
  }
  if (data.user && request.nextUrl.pathname.startsWith("/guide-demos") && !isEmailAllowedForGuideDemos(data.user.email)) return NextResponse.redirect(new URL("/admin?denied=guide-demos", request.url));
  return response;
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

export default async function middleware(req: NextRequest, _event: NextFetchEvent) {
  const { id: requestId, requestHeaders } = ensureRequestId(req);
  const requestWithId = new NextRequest(req, { headers: requestHeaders });
  const p = req.nextUrl.pathname;
  if ((p.startsWith("/api/admin") || p.startsWith("/api/integrations")) &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const isSignedWebhook = p.includes("/webhook");
    const idempotencyKey = req.headers.get("idempotency-key")?.trim() ?? "";
    if (!isSignedWebhook && !/^[A-Za-z0-9._:-]{8,200}$/.test(idempotencyKey)) {
      const invalid = NextResponse.json({ error: "Idempotency-Key is required" }, { status: 400 });
      invalid.headers.set("x-request-id", requestId);
      return invalid;
    }
    const contentType = req.headers.get("content-type")?.split(";", 1)[0].trim();
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 1_048_576) {
      const limited = NextResponse.json({ error: "Request body too large" }, { status: 413 });
      limited.headers.set("x-request-id", requestId);
      return limited;
    }
    if (contentType && contentType !== "application/json" && contentType !== "multipart/form-data") {
      const invalid = NextResponse.json({ error: "Unsupported content type" }, { status: 415 });
      invalid.headers.set("x-request-id", requestId);
      return invalid;
    }
  }
  if (p.startsWith("/api/admin") || p.startsWith("/api/integrations")) {
    const family = p.includes("export") || p.includes("search") || p.includes("lookup")
      ? "enumeration"
      : req.method === "GET" ? "read" : "mutation";
    const identity = requestWithId.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const policy = family === "mutation"
      ? { limit: 120, window: 60 }
      : family === "enumeration" ? { limit: 30, window: 60 } : { limit: 300, window: 60 };
    const rate = await checkAdminRateLimit(`${identity}:${family}`, policy.limit, policy.window);
    if (!rate.allowed) {
      const limited = NextResponse.json({ error: "Too many requests" }, { status: 429 });
      limited.headers.set("retry-after", String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))));
      limited.headers.set("x-request-id", requestId);
      return limited;
    }
  }
  if (p === "/api/integrations/channels/webhook") {
    const res = NextResponse.next({
      request: { headers: requestHeaders },
    });
    res.headers.set("x-request-id", requestId);
    return res;
  }
  if (p === "/api/integrations/chat-orders/intake") {
    const key = requestWithId.headers.get("x-internal-key");
    const expected = process.env.INTERNAL_CHAT_INTAKE_KEY?.trim();
    if (expected && key === expected) {
      const res = NextResponse.next({
        request: { headers: requestHeaders },
      });
      res.headers.set("x-request-id", requestId);
      return res;
    }
  }
  // API handlers own authentication and authorization. Avoid a second Supabase
  // session lookup here; it added an upstream round trip to every admin and
  // integration request while the route immediately revalidated the session.
  if (p.startsWith("/api/")) {
    const apiResponse = NextResponse.next({ request: { headers: requestHeaders } });
    apiResponse.headers.set("x-request-id", requestId);
    return apiResponse;
  }
  const response = await updateSupabaseSession(requestWithId);
  if (response instanceof NextResponse) {
    response.headers.set("x-request-id", requestId);
    return response;
  }
  const fallback = NextResponse.next({
    request: { headers: requestHeaders },
  });
  fallback.headers.set("x-request-id", requestId);
  return fallback;
}
