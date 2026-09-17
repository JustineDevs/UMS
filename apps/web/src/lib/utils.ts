export { cn } from "@universal-music-store/ui";

export function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

type CurrencyOptions = Intl.NumberFormatOptions & {
  currency?: string;
  locale?: string;
  noDecimals?: boolean;
};

export function formatCurrency(value: number, options?: CurrencyOptions) {
  const { currency = "PHP", locale = "en-PH", noDecimals, ...numberOptions } = options ?? {};
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    ...numberOptions,
    ...(noDecimals ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
  }).format(value);
}
