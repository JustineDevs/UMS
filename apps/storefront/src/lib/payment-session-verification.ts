const AUTHORIZED_PAYMENT_STATES = new Set([
  "authorized",
  "captured",
  "completed",
  "paid",
  "succeeded",
]);

function paymentStateValues(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const data = record.data && typeof record.data === "object"
    ? record.data as Record<string, unknown>
    : {};
  return [record.status, record.payment_status, data.status, data.payment_status]
    .filter((state): state is string => typeof state === "string")
    .map((state) => state.trim().toLowerCase());
}

export function isAuthorizedMedusaPaymentSession(
  session: unknown,
  row: { amount_minor?: number | null; currency?: string | null },
): boolean {
  if (!session || typeof session !== "object") return false;
  const record = session as Record<string, unknown>;
  const data = record.data && typeof record.data === "object"
    ? dataRecord(record.data)
    : {};
  const amount = record.amount ?? record.amount_minor ?? data.amount ?? data.amount_minor;
  const currency = record.currency_code ?? record.currency ?? data.currency_code ?? data.currency;
  return typeof row.amount_minor === "number" && Number.isSafeInteger(row.amount_minor) &&
    typeof amount === "number" && Number.isSafeInteger(amount) && amount === row.amount_minor &&
    typeof row.currency === "string" && Boolean(row.currency.trim()) &&
    typeof currency === "string" && currency.trim().toLowerCase() === row.currency.trim().toLowerCase() &&
    paymentStateValues(session).some((state) => AUTHORIZED_PAYMENT_STATES.has(state));
}

function dataRecord(value: object): Record<string, unknown> {
  return value as Record<string, unknown>;
}
