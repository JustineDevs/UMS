export type AccountMutationFailure = {
  error: string;
  correlationId: string;
};

export function accountMutationFailure(
  message: string,
  correlationId: string,
): AccountMutationFailure {
  return { error: message, correlationId };
}
