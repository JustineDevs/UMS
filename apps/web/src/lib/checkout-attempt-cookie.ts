import { cookies } from "next/headers";

export const CHECKOUT_ATTEMPT_COOKIE = "checkout_attempt_id";

export async function readCheckoutAttemptCookie(): Promise<string | null> {
  const value = (await cookies()).get(CHECKOUT_ATTEMPT_COOKIE)?.value?.trim();
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export function checkoutAttemptCookieHeader(correlationId: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${CHECKOUT_ATTEMPT_COOKIE}=${encodeURIComponent(correlationId)}; Path=/; Max-Age=1800; HttpOnly; SameSite=Lax${secure}`;
}
