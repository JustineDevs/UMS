import { createHash } from "node:crypto";

const BLOCKED_TERMS = ["kys", "nigger", "faggot", "cunt", "porn", "fuck"];
const URL_OR_CONTACT = /(https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\d\s().-]{7,}\d))/i;
const HTML = /<[^>]*>/;

function normalizeReviewBody(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function reviewBodyHash(value: string): string {
  return createHash("sha256").update(normalizeReviewBody(value)).digest("hex");
}

export function reviewFormTimingIsValid(
  formStartedAt: number,
  now = Date.now(),
): boolean {
  return (
    Number.isFinite(formStartedAt) &&
    formStartedAt <= now + 5_000 &&
    now - formStartedAt >= 2_000
  );
}

export function validateReviewBody(value: string):
  | { ok: true; cleaned: string; normalized: string; hash: string }
  | { ok: false; reason: string } {
  const body = value.trim();
  const normalized = normalizeReviewBody(body);
  if (body.length < 5) return { ok: false, reason: "Review must be at least 5 characters." };
  if (body.length > 2_000) return { ok: false, reason: "Review must be 2,000 characters or fewer." };
  if (HTML.test(body)) return { ok: false, reason: "HTML is not allowed in reviews." };
  if (URL_OR_CONTACT.test(body)) return { ok: false, reason: "Links and contact details are not allowed in reviews." };
  if (BLOCKED_TERMS.some((term) => new RegExp(`\\b${term}\\b`, "i").test(body))) {
    return { ok: false, reason: "This review contains language that cannot be submitted." };
  }
  if (
    /^(.)\1{4,}$/.test(normalized) ||
    /(?:asdf|qwer|zxcv|hjkl)/i.test(normalized) ||
    (/^[a-z]{7,}$/.test(normalized) && !/[aeiou]/.test(normalized))
  ) {
    return { ok: false, reason: "Please provide a meaningful review." };
  }
  return { ok: true, cleaned: body, normalized, hash: reviewBodyHash(body) };
}
