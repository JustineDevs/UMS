export function cmsMutationHeaders(contentType = "application/json"): Record<string, string> {
  return {
    "Content-Type": contentType,
    "Idempotency-Key": globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
}
