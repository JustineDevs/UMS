export function matchesProviderOrderId(
  row: { provider_payment_id?: string | null; provider_session_id?: string | null },
  providerOrderId: string,
): boolean {
  return row.provider_payment_id === providerOrderId || row.provider_session_id === providerOrderId;
}
