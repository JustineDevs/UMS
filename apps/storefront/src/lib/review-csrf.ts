import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE = "review_csrf";
const MAX_AGE_MS = 30 * 60 * 1000;

function secret(): string {
  return process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim() || "development-review-csrf";
}

export function reviewCsrfCookieName(): string {
  return COOKIE;
}

export function createReviewCsrfToken(): string {
  const payload = `${Date.now()}.${randomBytes(18).toString("base64url")}`;
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyReviewCsrfToken(token: unknown, cookie: string | undefined): boolean {
  if (typeof token !== "string" || !cookie || token !== cookie) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const issued = Number(parts[0]);
  if (!Number.isFinite(issued) || Date.now() - issued < 0 || Date.now() - issued > MAX_AGE_MS) return false;
  const expected = createHmac("sha256", secret()).update(`${parts[0]}.${parts[1]}`).digest("base64url");
  const actualBuffer = Buffer.from(parts[2]);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
