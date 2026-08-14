import { randomUUID } from "node:crypto";
import { defineMiddlewares } from "@medusajs/framework/http";
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { z } from "zod";

/**
 * Same semantics as `@universal-music-store/rate-limits` (Medusa backend compiles as CJS; that package is ESM-only).
 */
function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

const WINDOW_MS = 60_000;
const MAX = Math.max(
  1,
  Number.parseInt(process.env.MEDUSA_STORE_RATE_LIMIT_MAX ?? "120", 10) || 120,
);

const buckets = new Map<string, { count: number; reset: number }>();
const checkoutBuckets = new Map<string, { count: number; reset: number }>();

const CHECKOUT_POST_MAX = readPositiveIntEnv("RATE_LIMIT_STORE_CHECKOUT_POST_MAX", 60);
const CHECKOUT_WINDOW_MS = readPositiveIntEnv(
  "RATE_LIMIT_STORE_CHECKOUT_POST_WINDOW_MS",
  60_000,
);

function clientKey(req: MedusaRequest): string {
  const xff = req.headers["x-forwarded-for"];
  const first =
    typeof xff === "string"
      ? xff.split(",")[0]?.trim()
      : Array.isArray(xff)
        ? xff[0]
        : "";
  if (first) {
    return first;
  }
  const socket = (req as MedusaRequest & { socket?: { remoteAddress?: string } })
    .socket;
  return socket?.remoteAddress ?? "unknown";
}

function requestCorrelationId(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const incoming = req.headers["x-request-id"];
  const id =
    typeof incoming === "string" && incoming.trim().length > 0
      ? incoming.trim()
      : randomUUID();
  res.setHeader("x-request-id", id);
  next();
}

function storeRateLimit(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const ip = clientKey(req);
  // Keep independent store endpoints from consuming one shared catalog bucket.
  // The checkout POST limiter below remains separately scoped and stricter.
  const route = String(
    (req as MedusaRequest & { originalUrl?: string }).originalUrl ??
      req.url ??
      "*",
  ).split("?", 1)[0] || "*";
  const key = `${ip}:${route}`;
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.reset) {
    b = { count: 0, reset: now + WINDOW_MS };
    buckets.set(key, b);
  }
  b.count += 1;
  res.setHeader("X-RateLimit-Limit", String(MAX));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, MAX - b.count)));
  if (b.count > MAX) {
    res.status(429).json({ message: "Too many requests", code: "RATE_LIMIT" });
    return;
  }
  next();
}

/**
 * Extra velocity limit for POST /store/carts and /store/payment-collections (checkout intent).
 * Complements the general /store limit; keyed by client IP only (body not parsed here).
 */
function storeCheckoutPostRateLimit(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  if (req.method !== "POST") {
    next();
    return;
  }
  const path = String(
    (req as MedusaRequest & { originalUrl?: string }).originalUrl ??
      req.url ??
      "",
  );
  if (
    !path.includes("/store/carts") &&
    !path.includes("/store/payment-collections")
  ) {
    next();
    return;
  }
  const ip = clientKey(req);
  const key = `checkout-post:${ip}`;
  const now = Date.now();
  let b = checkoutBuckets.get(key);
  if (!b || now > b.reset) {
    b = { count: 0, reset: now + CHECKOUT_WINDOW_MS };
    checkoutBuckets.set(key, b);
  }
  b.count += 1;
  res.setHeader("X-Checkout-RateLimit-Limit", String(CHECKOUT_POST_MAX));
  res.setHeader(
    "X-Checkout-RateLimit-Remaining",
    String(Math.max(0, CHECKOUT_POST_MAX - b.count)),
  );
  if (b.count > CHECKOUT_POST_MAX) {
    console.error(
      "[checkout-velocity] blocked ip=",
      ip,
      "path=",
      path.slice(0, 120),
    );
    res.status(429).json({
      message: "Too many checkout requests",
      code: "CHECKOUT_VELOCITY",
    });
    return;
  }
  next();
}

const loyaltyRedemptionSchema = z.object({
  points: z.number().int().min(1, "points must be at least 1"),
});

function validateLoyaltyRedemptionBody(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const result = loyaltyRedemptionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      message: result.error.issues[0]?.message ?? "Invalid request body",
      code: "VALIDATION",
    });
    return;
  }
  (req as MedusaRequest & { validatedBody: unknown }).validatedBody = result.data;
  next();
}

function rootServiceInfo(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  if (req.originalUrl !== "/" || (req.method !== "GET" && req.method !== "HEAD")) {
    next();
    return;
  }

  res.status(200).json({
    service: "Medusa",
    health: "/health",
    store: "/store",
    admin: "/admin",
  });
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "*",
      middlewares: [rootServiceInfo],
    },
    {
      matcher: "/store*",
      middlewares: [
        requestCorrelationId,
        storeRateLimit,
        storeCheckoutPostRateLimit,
      ],
    },
    {
      matcher: "/store/carts/:id/loyalty",
      method: "POST",
      middlewares: [validateLoyaltyRedemptionBody],
    },
  ],
});
