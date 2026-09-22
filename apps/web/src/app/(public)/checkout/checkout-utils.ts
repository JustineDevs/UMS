const checkoutCurrencyFormatters = new Map<string, Intl.NumberFormat>();

export function formatCheckoutMoney(amount: number, currencyCode: string): string {
  const code = currencyCode.length === 3 ? currencyCode.toUpperCase() : "PHP";
  try {
    let formatter = checkoutCurrencyFormatters.get(code);
    if (!formatter) {
      formatter = new Intl.NumberFormat("en-PH", { style: "currency", currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 });
      checkoutCurrencyFormatters.set(code, formatter);
    }
    return formatter.format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}
