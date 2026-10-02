export const CHECKOUT_ATTEMPT_COOKIE = "checkout_attempt_id";

export function checkoutAttemptCookieHeader(correlationId: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${CHECKOUT_ATTEMPT_COOKIE}=${encodeURIComponent(correlationId)}; Path=/; Max-Age=1800; HttpOnly; SameSite=Lax${secure}`;
}
