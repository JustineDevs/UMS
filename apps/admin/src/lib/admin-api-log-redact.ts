const SENSITIVE_KEY =
  /password|passwd|secret|token|ciphertext|apikey|api_key|privatekey|private_key|clientsecret|client_secret|webhooksecret|webhook_secret|secretkey|secret_key|authorization|bearer|refreshtoken|access_token|refresh_token|credential|kek|dek|encrypted|pin|cardnumber|card_number|cvv|cvc|iban|bankaccount|bank_account/i;

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

/**
 * Deep-clones plain JSON-ish structures for stdout logging and strips values whose keys
 * look like secret material. Does not handle Map/Set/Date (pass plain objects only).
 */
export function redactAdminApiLogDetail(
  detail: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!detail) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(detail)) {
    if (isSensitiveKey(k)) {
      out[k] = "[REDACTED]";
      continue;
    }
    out[k] = redactUnknown(v);
  }
  return out;
}

function redactUnknown(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > 2000 ? `${value.slice(0, 200)}…[truncated]` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((x) => redactUnknown(x));
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (isSensitiveKey(k)) {
        next[k] = "[REDACTED]";
      } else {
        next[k] = redactUnknown(v);
      }
    }
    return next;
  }
  return "[unserializable]";
}
