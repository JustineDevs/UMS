export type StoreRegion = {
  id: string;
  name: string;
  currencyCode: string;
  taxRate: number;
  countries: string[];
  defaultLocale: string;
  paymentProviders: string[];
  fulfillmentProviders: string[];
};

export type RegionConfig = {
  regions: StoreRegion[];
  defaultRegionId: string;
};

export function resolveRegionFromCountry(
  config: RegionConfig,
  countryCode: string,
): StoreRegion | null {
  const upper = countryCode.toUpperCase();
  return (
    config.regions.find((r) => r.countries.includes(upper)) ?? null
  );
}

export function getDefaultRegion(config: RegionConfig): StoreRegion | null {
  return (
    config.regions.find((r) => r.id === config.defaultRegionId) ?? config.regions[0] ?? null
  );
}

export function formatPrice(
  amountMinor: number,
  currencyCode: string,
  locale = "en-PH",
): string {
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${currencyCode.toUpperCase()} ${major.toFixed(2)}`;
  }
}

export function isCurrencyZeroDecimal(code: string): boolean {
  const zeroDecimalCurrencies = new Set([
    "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
    "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
  ]);
  return zeroDecimalCurrencies.has(code.toUpperCase());
}

export function minorToMajor(amount: number, currencyCode: string): number {
  return isCurrencyZeroDecimal(currencyCode) ? amount : amount / 100;
}

export function majorToMinor(amount: number, currencyCode: string): number {
  return isCurrencyZeroDecimal(currencyCode) ? amount : Math.round(amount * 100);
}

export const PH_REGION: StoreRegion = {
  id: "reg_ph",
  name: "Philippines",
  currencyCode: "PHP",
  taxRate: 0.12,
  countries: ["PH"],
  defaultLocale: "en-PH",
  paymentProviders: ["stripe", "paypal", "xendit", "cod"],
  fulfillmentProviders: ["manual", "jt-express"],
};
