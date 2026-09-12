const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT_LEN = 2_000;
const MAX_LINES = 50;

export type CartAbandonmentRecord = {
  email: string | null;
  lineCount: number;
  path: string | null;
  referrer: string | null;
  clientTimestamp: string | null;
};

export function buildCartAbandonmentRecord(body: unknown): CartAbandonmentRecord | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const rawEmail = typeof value.email === "string" ? value.email.trim().slice(0, 320) : "";
  const normalizedEmail = rawEmail.toLowerCase();
  const lines = Array.isArray(value.lines) ? value.lines.slice(0, MAX_LINES) : [];
  return {
    email: normalizedEmail && EMAIL_RE.test(normalizedEmail) ? normalizedEmail : null,
    lineCount: lines.length,
    path: typeof value.path === "string" ? value.path.slice(0, MAX_TEXT_LEN) : null,
    referrer: typeof value.referrer === "string" ? value.referrer.slice(0, MAX_TEXT_LEN) : null,
    clientTimestamp:
      typeof value.clientTimestamp === "string" ? value.clientTimestamp.slice(0, 80) : null,
  };
}
