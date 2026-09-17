const MINOR_UNIT_DIGITS: Record<string, number> = {
  BHD: 3, JOD: 3, KWD: 3, OMR: 3, TND: 3,
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, JPY: 0, KMF: 0, KRW: 0,
  MGA: 0, PYG: 0, RWF: 0, UGX: 0, VND: 0, VUV: 0, XAF: 0,
  XOF: 0, XPF: 0,
};

export function minorUnitDivisor(currencyCode: string): number {
  return 10 ** (MINOR_UNIT_DIGITS[currencyCode.trim().toUpperCase()] ?? 2);
}

export function formatPrice(
  amountMinor: number,
  currencyCode: string,
  locale = "en-PH",
): string {
  const major = minorToMajor(amountMinor, currencyCode);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode.toUpperCase(),
      minimumFractionDigits: MINOR_UNIT_DIGITS[currencyCode.trim().toUpperCase()] ?? 2,
    }).format(major);
  } catch {
    return `${currencyCode.toUpperCase()} ${major.toFixed(MINOR_UNIT_DIGITS[currencyCode.trim().toUpperCase()] ?? 2)}`;
  }
}

export function minorToMajor(amount: number, currencyCode: string): number {
  return amount / minorUnitDivisor(currencyCode);
}

export function majorToMinor(amount: number, currencyCode: string): number {
  return Math.round(amount * minorUnitDivisor(currencyCode));
}
