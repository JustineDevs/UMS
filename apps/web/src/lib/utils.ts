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

const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function formatCurrency(value: number, options?: CurrencyOptions) {
  const { currency = "PHP", locale = "en-PH", noDecimals, ...numberOptions } = options ?? {};
  const formatterOptions = {
    style: "currency" as const,
    currency,
    ...numberOptions,
    ...(noDecimals ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
  };
  const key = JSON.stringify([locale, formatterOptions]);
  let formatter = currencyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, formatterOptions);
    currencyFormatters.set(key, formatter);
  }
  return formatter.format(value);
}
