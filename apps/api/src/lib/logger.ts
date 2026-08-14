/**
 * Structured JSON logs to stdout/stderr (aligned with log aggregators / Vercel / Docker).
 * Payloads are sanitized before stringify to reduce accidental PII/credential leakage.
 */

/**
 * Keys whose values are always redacted. Uses word boundaries so `tokenPreview`
 * is not treated as `token`.
 */
const SENSITIVE_KEY_PATTERN =
  /\b(?:password|pwd|passwd|token|secret|authorization|cookie|email|bearer|credential|apikey)\b|(?:^|_)api[_-]?key(?:_|$)|(?:^|_)access[_-]?token(?:_|$)|(?:^|_)refresh[_-]?token(?:_|$)|(?:^|_)client[_-]?secret(?:_|$)/i;

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

/** Whole-string email (simple) — redact when value is only an email. */
const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function redactString(value: string): string {
  const t = value.trim();
  if (t.length > 80 && /^eyJ[A-Za-z0-9_-]+/.test(t)) {
    return "[REDACTED_JWT]";
  }
  if (t.length <= 320 && EMAIL_LIKE.test(t)) {
    return "[REDACTED_EMAIL]";
  }
  return value;
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v));
  if (typeof value === "object") {
    return sanitizeLogPayload(value as Record<string, unknown>);
  }
  return value;
}

/**
 * Deep-clone style sanitization for log records. Exported for unit tests.
 * Redacts known sensitive keys, JWT-shaped strings, and whole-string emails.
 */
export function sanitizeLogPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(payload)) {
    if (isSensitiveKey(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    out[key] = sanitizeValue(raw);
  }
  return out;
}

function logJson(
  stream: "stdout" | "stderr",
  payload: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...sanitizeLogPayload(payload),
  });
  if (stream === "stderr") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function logInfo(payload: Record<string, unknown>): void {
  logJson("stdout", payload);
}

export function logStartup(message: string, extra?: Record<string, unknown>): void {
  logInfo({ level: "info", msg: message, ...extra });
}

/** Dev-only stacks: not sanitized (local debugging); avoid logging prod secrets here. */
export function logDevErrorStack(stack: string): void {
  logJson("stderr", { type: "error_stack", stack });
}
