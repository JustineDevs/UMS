const STALE_CHECKOUT_MESSAGE_PATTERNS = [
  /\breview\b/i,
  /\bexpired\b/i,
  /\bstale\b/i,
  /\binvalid\b/i,
  /\bchanged\b/i,
  /\bupdated total\b/i,
  /\bquote\b/i,
  /\btotals\b/i,
] as const;

const NON_STALE_CHECKOUT_MESSAGE_PATTERNS = [
  /MEDUSA_SECRET_API_KEY/i,
  /NEXT_PUBLIC_MEDUSA_/i,
  /sign in to load checkout totals/i,
  /delivery profile/i,
  /complete your delivery profile/i,
  /could not confirm your delivery profile/i,
] as const;

export function isStaleCheckoutMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  if (NON_STALE_CHECKOUT_MESSAGE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return false;
  }
  return STALE_CHECKOUT_MESSAGE_PATTERNS.some((pattern) => pattern.test(trimmed));
}
