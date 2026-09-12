export function resolvePaymentReceiptOrganizationId(input: {
  paymentAttemptOrganizationId?: string | null;
  configuredOrganizationId?: string | null;
}): string | null {
  return (
    input.paymentAttemptOrganizationId?.trim() ||
    input.configuredOrganizationId?.trim() ||
    null
  );
}
