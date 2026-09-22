import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { E2E_SESSION_COOKIE } from "./e2e-session-constants";

export { E2E_SESSION_COOKIE } from "./e2e-session-constants";
const MAX_AGE_SECONDS = 8 * 60 * 60;

function enabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.UVS_E2E_REAL_SESSION === "1" && process.env.VERCEL !== "1";
}

function secret(): string | undefined {
  return process.env.AUTH_SECRET?.trim() || undefined;
}

function signature(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function createE2eSessionValue(email: string, now = Date.now()): string | null {
  if (!enabled()) return null;
  const key = secret();
  if (!key) return null;
  const payload = `${email.trim().toLowerCase()}.${Math.floor(now / 1000)}`;
  return `${payload}.${signature(payload, key)}`;
}

export function verifyE2eSessionValue(value: string | undefined, now = Date.now()): string | null {
  if (!enabled() || !value) return null;
  const key = secret();
  if (!key) return null;
  const signatureSeparator = value.lastIndexOf(".");
  const issuedAtSeparator = value.lastIndexOf(".", signatureSeparator - 1);
  if (signatureSeparator <= 0 || issuedAtSeparator <= 0) return null;
  const email = value.slice(0, issuedAtSeparator);
  const issuedAtRaw = value.slice(issuedAtSeparator + 1, signatureSeparator);
  const actual = value.slice(signatureSeparator + 1);
  const issuedAt = Number(issuedAtRaw);
  if (!email || !Number.isInteger(issuedAt) || issuedAt <= 0) return null;
  const age = Math.floor(now / 1000) - issuedAt;
  if (age < 0 || age > MAX_AGE_SECONDS) return null;
  const expected = signature(`${email}.${issuedAtRaw}`, key);
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  return email;
}

export async function getE2eSessionEmail(): Promise<string | null> {
  const value = (await cookies()).get(E2E_SESSION_COOKIE)?.value;
  return verifyE2eSessionValue(value);
}

export function e2eSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}
