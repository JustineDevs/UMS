import { DEFAULT_PUBLIC_SITE_ORIGIN } from "@universal-music-store/sdk";

export const CHECKOUT_SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_PUBLIC_SITE_ORIGIN
).replace(/\/$/, "");

export function formatCheckoutMoney(amount: number, currencyCode: string): string {
  const code = currencyCode.length === 3 ? currencyCode.toUpperCase() : "PHP";
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}
