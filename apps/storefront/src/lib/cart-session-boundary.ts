import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  resolveOpaqueTrackingCapability,
  verifyTrackingCapability,
} from "@universal-music-store/sdk";

const TOKEN_TTL_MS = 10 * 60 * 1000;

function secret(): string {
  const value =
    process.env.CART_BIND_SECRET?.trim() ||
    process.env.TRACKING_HMAC_SECRET?.trim();
  if (!value)
    throw new Error("CART_BIND_SECRET or TRACKING_HMAC_SECRET is required");
  return value;
}

function mac(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createCartBindToken(): string {
  const payload = `${Date.now()}:${randomBytes(24).toString("base64url")}`;
  return `${payload}.${mac(payload)}`;
}

export function verifyCartBindToken(token: unknown): boolean {
  try {
    if (typeof token !== "string") return false;
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return false;
    const timestamp = Number(payload.split(":", 1)[0]);
    if (
      !Number.isFinite(timestamp) ||
      Date.now() - timestamp > TOKEN_TTL_MS ||
      Date.now() < timestamp - 60_000
    ) {
      return false;
    }
    const expected = mac(payload);
    const actual = Buffer.from(signature);
    const wanted = Buffer.from(expected);
    return actual.length === wanted.length && timingSafeEqual(actual, wanted);
  } catch {
    return false;
  }
}

export type CartBoundaryResult = {
  status: 200 | 403;
  body: { ok: true } | { error: "Cart ownership could not be verified" };
};

/** The HttpOnly cart cookie is the browser session's one-time cart binding. */
export function validateCartSessionBinding(
  requestedCartId: string,
  boundCartId: string | null,
  hasValidBindProof = false,
): CartBoundaryResult {
  if (boundCartId && requestedCartId !== boundCartId && !hasValidBindProof) {
    return {
      status: 403,
      body: { error: "Cart ownership could not be verified" },
    };
  }
  return { status: 200, body: { ok: true } };
}

/** Existing-cart mutations require the current HttpOnly binding, not just a valid cart ID. */
export function validateExistingCartBinding(
  requestedCartId: string,
  boundCartId: string | null,
): CartBoundaryResult {
  if (!boundCartId || requestedCartId !== boundCartId) {
    return {
      status: 403,
      body: { error: "Cart ownership could not be verified" },
    };
  }
  return { status: 200, body: { ok: true } };
}

/** A guest cart may be claimed; a cart already tied to another email may not. */
export function cartEmailMatchesOwner(
  cartEmail: unknown,
  ownerEmail: string,
): boolean {
  if (typeof cartEmail !== "string" || !cartEmail.trim()) return true;
  return cartEmail.trim().toLowerCase() === ownerEmail.trim().toLowerCase();
}

export function validateCartResumeQuery(
  requestedCartId: string | null,
  boundCartId: string | null,
): boolean {
  return !requestedCartId || requestedCartId === boundCartId;
}

export function validateCartResumeAccess(
  requestedCartId: string | null,
  boundCartId: string | null,
  recoveryToken: string | null,
): boolean {
  if (validateCartResumeQuery(requestedCartId, boundCartId)) return true;
  return Boolean(
    requestedCartId &&
    recoveryToken &&
    (resolveCartResumeCapability(recoveryToken) === requestedCartId ||
      verifyTrackingCapability(requestedCartId, recoveryToken)),
  );
}

export function resolveCartResumeCapability(
  token: string | null,
): string | null {
  if (!token?.trim()) return null;
  const opaqueCartId = resolveOpaqueTrackingCapability(token.trim());
  if (opaqueCartId?.startsWith("cart_")) return opaqueCartId;
  return null;
}
