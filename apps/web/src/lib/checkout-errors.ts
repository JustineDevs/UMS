/**
 * Maps Medusa store API failures to storefront-safe messages and cleans up
 * abandoned carts after partial checkout steps.
 */

import { isMedusaAdminConfigurationError } from "./medusa-admin-configuration-error";

const INTERNAL_ENV_ERROR_SNIPPETS = [
  /MEDUSA_SECRET_API_KEY/i,
  /MEDUSA_ADMIN_API_SECRET/i,
  /NEXT_PUBLIC_MEDUSA_/i,
  /\.env\.local/i,
  /repo root \.env\.local/i,
] as const;

function extractMedusaErrorText(err: unknown): string {
  if (err instanceof Error) {
    const anyErr = err as Error & {
      response?: { data?: unknown; status?: number };
    };
    const data = anyErr.response?.data;
    if (data && typeof data === "object") {
      const o = data as Record<string, unknown>;
      if (typeof o.message === "string" && o.message.trim()) return o.message;
      if (typeof o.type === "string" && typeof o.message === "string")
        return o.message;
    }
    if (err.message.trim()) return err.message;
  }
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
    if (typeof o.error === "string") return o.error;
  }
  return "";
}

export function formatMedusaCheckoutError(err: unknown): string {
  if (isMedusaAdminConfigurationError(err)) {
    return "Checkout is temporarily unavailable. Please try again shortly or contact support if this continues.";
  }
  const raw = extractMedusaErrorText(err);
  if (
    (err instanceof Error && err.name === "AbortError") ||
    /timed out|aborted/i.test(raw)
  ) {
    return "Checkout service took too long to respond. Please try again.";
  }
  if (INTERNAL_ENV_ERROR_SNIPPETS.some((re) => re.test(raw))) {
    return "Checkout is temporarily unavailable. Please try again shortly or contact support if this continues.";
  }
  const lower = raw.toLowerCase();
  if (
    lower.includes("inventory") ||
    lower.includes("stock") ||
    lower.includes("insufficient") ||
    lower.includes("not enough") ||
    lower.includes("out of stock") ||
    lower.includes("unavailable") ||
    lower.includes("reserved")
  ) {
    return "One or more items are no longer available in the requested quantity. Update your bag and try again.";
  }
  if (
    (lower.includes("variant") && lower.includes("does not")) ||
    lower.includes("invalid variant")
  ) {
    return "A product variant is no longer available. Update your bag and try again.";
  }
  if (raw.length > 0 && raw.length < 400) return raw;
  return "Checkout could not be completed. Please try again.";
}

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
  if (
    NON_STALE_CHECKOUT_MESSAGE_PATTERNS.some((pattern) => pattern.test(trimmed))
  ) {
    return false;
  }
  return STALE_CHECKOUT_MESSAGE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export async function tryDeleteStoreCart(
  cartId: string,
  baseUrl: string,
  publishableKey: string,
): Promise<void> {
  const root = baseUrl.replace(/\/$/, "");
  try {
    const res = await fetch(
      `${root}/store/carts/${encodeURIComponent(cartId)}?fields=id,*items`,
      {
        headers: { "x-publishable-api-key": publishableKey },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (res.status === 404 || !res.ok) return;
    const payload = (await res.json().catch(() => null)) as {
      cart?: { items?: Array<{ id?: string }> };
    } | null;
    await Promise.all(
      (payload?.cart?.items ?? [])
        .map((item) => item.id?.trim())
        .filter((id): id is string => Boolean(id))
        .map((lineId) =>
          fetch(
            `${root}/store/carts/${encodeURIComponent(cartId)}/line-items/${encodeURIComponent(lineId)}`,
            {
              method: "DELETE",
              headers: { "x-publishable-api-key": publishableKey },
              signal: AbortSignal.timeout(5_000),
            },
          ),
        ),
    );
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[checkout] rollback cart cleanup failed:", e);
    }
  }
}
