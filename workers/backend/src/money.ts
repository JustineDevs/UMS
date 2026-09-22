const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);

export function minorUnitDivisor(currencyCode: string): number {
  const code = currencyCode.trim().toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 1;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 1_000;
  return 100;
}

export function minorToMajor(amountMinor: number, currencyCode: string): number {
  return amountMinor / minorUnitDivisor(currencyCode);
}

export function majorToMinor(amountMajor: number, currencyCode: string): number {
  return Math.round(amountMajor * minorUnitDivisor(currencyCode));
}

export function formatMajorAmount(amountMinor: number, currencyCode: string): string {
  const divisor = minorUnitDivisor(currencyCode);
  const fractionDigits = divisor === 1 ? 0 : divisor === 1_000 ? 3 : 2;
  return minorToMajor(amountMinor, currencyCode).toFixed(fractionDigits);
}
