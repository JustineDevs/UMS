export type SupportedLocale = "en-PH" | "fil-PH" | "en-US";

export const DEFAULT_LOCALE: SupportedLocale = "en-PH";

export type TranslationDict = Record<string, string>;

const translations: Record<SupportedLocale, TranslationDict> = {
  "en-PH": {},
  "fil-PH": {},
  "en-US": {},
};

export function registerTranslations(locale: SupportedLocale, dict: TranslationDict): void {
  translations[locale] = { ...translations[locale], ...dict };
}

export function t(key: string, locale: SupportedLocale = DEFAULT_LOCALE, vars?: Record<string, string | number>): string {
  const dict = translations[locale] ?? translations[DEFAULT_LOCALE];
  let value = dict[key] ?? translations[DEFAULT_LOCALE]?.[key] ?? key;

  if (vars) {
    for (const [varKey, varVal] of Object.entries(vars)) {
      value = value.replace(new RegExp(`\\{${varKey}\\}`, "g"), String(varVal));
    }
  }
  return value;
}

export function formatCurrency(amount: number, currencyCode: string, locale: SupportedLocale = DEFAULT_LOCALE): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

export function formatDate(date: Date | string, locale: SupportedLocale = DEFAULT_LOCALE, style: "short" | "long" = "short"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  try {
    return d.toLocaleDateString(locale, {
      year: "numeric",
      month: style === "long" ? "long" : "short",
      day: "numeric",
    });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function formatNumber(n: number, locale: SupportedLocale = DEFAULT_LOCALE): string {
  try {
    return new Intl.NumberFormat(locale).format(n);
  } catch {
    return String(n);
  }
}

export function detectLocale(acceptLanguage?: string): SupportedLocale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const lower = acceptLanguage.toLowerCase();
  if (lower.includes("fil") || lower.includes("tl")) return "fil-PH";
  if (lower.includes("en-us")) return "en-US";
  if (lower.includes("en")) return "en-PH";
  return DEFAULT_LOCALE;
}

registerTranslations("en-PH", {
  "cart.empty": "Your cart is empty",
  "cart.add": "Add to cart",
  "cart.checkout": "Proceed to checkout",
  "product.outOfStock": "Out of stock",
  "product.inStock": "In stock",
  "order.status.pending": "Pending",
  "order.status.processing": "Processing",
  "order.status.shipped": "Shipped",
  "order.status.delivered": "Delivered",
  "order.status.cancelled": "Cancelled",
  "search.placeholder": "Search products...",
  "search.noResults": "No products found",
  "account.orders": "My Orders",
  "account.addresses": "Addresses",
  "account.profile": "Profile",
});

registerTranslations("fil-PH", {
  "cart.empty": "Walang laman ang iyong cart",
  "cart.add": "Idagdag sa cart",
  "cart.checkout": "Mag-checkout",
  "product.outOfStock": "Ubos na",
  "product.inStock": "May stock",
  "order.status.pending": "Naghihintay",
  "order.status.processing": "Pinoproseso",
  "order.status.shipped": "Ipinadala na",
  "order.status.delivered": "Naihatid na",
  "order.status.cancelled": "Kinansela",
  "search.placeholder": "Hanapin ang produkto...",
  "search.noResults": "Walang nahanap na produkto",
  "account.orders": "Aking mga Order",
  "account.addresses": "Mga Address",
  "account.profile": "Profile",
});
