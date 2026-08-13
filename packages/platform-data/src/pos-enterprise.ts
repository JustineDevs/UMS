export type PosCashCount = { denomination: number; quantity: number };

export type PosReconciliation = {
  openingCash: number;
  cashSales: number;
  cashRefunds: number;
  payouts: number;
  expectedCash: number;
  countedCash: number;
  variance: number;
};

export function calculatePosReconciliation(input: {
  openingCash: number;
  cashSales: number;
  cashRefunds?: number;
  payouts?: number;
  countedCash: number;
}): PosReconciliation {
  const values = [input.openingCash, input.cashSales, input.cashRefunds ?? 0, input.payouts ?? 0, input.countedCash];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new Error("Cash values must be finite and non-negative");
  const expectedCash = Math.round((input.openingCash + input.cashSales - (input.cashRefunds ?? 0) - (input.payouts ?? 0)) * 100) / 100;
  return { openingCash: input.openingCash, cashSales: input.cashSales, cashRefunds: input.cashRefunds ?? 0, payouts: input.payouts ?? 0, expectedCash, countedCash: input.countedCash, variance: Math.round((input.countedCash - expectedCash) * 100) / 100 };
}

export function countCash(values: readonly PosCashCount[]): number {
  return Math.round(values.reduce((sum, item) => {
    if (!Number.isFinite(item.denomination) || item.denomination < 0 || !Number.isInteger(item.quantity) || item.quantity < 0) throw new Error("Invalid cash count");
    return sum + item.denomination * item.quantity;
  }, 0) * 100) / 100;
}

export type PosFiscalProfile = { jurisdiction: string; registrationNumber: string; invoicePrefix: string; enabled: boolean };

export function validateFiscalProfile(input: PosFiscalProfile): PosFiscalProfile {
  const normalized = { jurisdiction: input.jurisdiction.trim().toUpperCase(), registrationNumber: input.registrationNumber.trim(), invoicePrefix: input.invoicePrefix.trim().toUpperCase(), enabled: Boolean(input.enabled) };
  if (!normalized.jurisdiction || normalized.jurisdiction.length > 16) throw new Error("Invalid fiscal jurisdiction");
  if (!normalized.registrationNumber || normalized.registrationNumber.length > 64) throw new Error("Invalid fiscal registration number");
  if (!normalized.invoicePrefix || !/^[A-Z0-9_-]{1,16}$/.test(normalized.invoicePrefix)) throw new Error("Invalid fiscal invoice prefix");
  return normalized;
}

export type PosTerminalCertification = { provider: string; model: string; firmware: string; certificationId: string; expiresAt?: string | null };

export function validateTerminalCertification(input: PosTerminalCertification): PosTerminalCertification {
  const value = { provider: input.provider.trim(), model: input.model.trim(), firmware: input.firmware.trim(), certificationId: input.certificationId.trim(), expiresAt: input.expiresAt?.trim() || null };
  if (!value.provider || !value.model || !value.firmware || !value.certificationId) throw new Error("Terminal certification fields are required");
  if (value.expiresAt && Number.isNaN(Date.parse(value.expiresAt))) throw new Error("Invalid terminal certification expiry");
  return value;
}
