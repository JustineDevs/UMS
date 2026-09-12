export function isPrivacyErasureConfirmation(body: unknown): boolean {
  return Boolean(
    body &&
      typeof body === "object" &&
      (body as { confirmation?: unknown }).confirmation === "DELETE",
  );
}
