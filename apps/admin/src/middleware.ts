import { NextResponse } from "next/server";
import { NextRequest, type NextFetchEvent } from "next/server";
import { withAuth } from "next-auth/middleware";
import { isEmailAllowedForGuideDemos } from "@/lib/admin-allowed-emails";
import { checkAdminRateLimit } from "@/lib/admin-rate-limit";

const authMiddleware = withAuth({
  pages: { signIn: "/sign-in" },
  callbacks: {
    authorized: ({ token, req }) => {
      if (process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production") {
        return true;
      }
      const p = req.nextUrl.pathname;
      if (p.startsWith("/guide-demos")) {
        const email = token?.email as string | undefined;
        return isEmailAllowedForGuideDemos(email);
      }
      const r = token?.role as string | undefined;
      return r === "admin" || r === "staff";
    },
  },
});

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

function hasDangerousJsonKey(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasDangerousJsonKey(item, seen));
  return Object.entries(value).some(([key, nested]) =>
    key === "__proto__" || key === "constructor" || key === "prototype" || hasDangerousJsonKey(nested, seen),
  );
}

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
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
    if (contentType === "application/json" && req.body) {
      try {
        const candidate = await req.clone().json();
        if (hasDangerousJsonKey(candidate)) {
          const invalid = NextResponse.json({ error: "Invalid request" }, { status: 400 });
          invalid.headers.set("x-request-id", requestId);
          return invalid;
        }
      } catch {
        const invalid = NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
        invalid.headers.set("x-request-id", requestId);
        return invalid;
      }
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
  const response = (
    authMiddleware as unknown as (
      _req: NextRequest,
      _event: NextFetchEvent,
    ) => Response | Promise<Response>
  )(requestWithId, event);
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

export const config = {
  matcher: [
    "/admin/:path*",
    "/guide-demos/:path*",
    "/api/admin/:path*",
    "/api/integrations/:path*",
  ],
};
