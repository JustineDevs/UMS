/**
 * Medusa JS SDK errors are often `Error` with a generic message; the Admin API body
 * may live on `response.data` (fetch-style) or nested fields. Use this for staff-visible messages.
 */
export function formatMedusaSdkError(e: unknown): string {
  if (e == null) return "Unknown error";
  if (typeof e === "string") return e;
  if (typeof e === "number" || typeof e === "boolean") return String(e);

  if (e instanceof Error) {
    const any = e as Error & {
      status?: number;
      response?: { status?: number; data?: unknown };
    };
    const data = any.response?.data;
    if (data && typeof data === "object") {
      const rec = data as Record<string, unknown>;
      const msg = rec.message;
      if (typeof msg === "string" && msg.trim()) return msg.trim();
      if (Array.isArray(rec.errors) && rec.errors.length > 0) {
        return JSON.stringify(rec.errors);
      }
      if (typeof rec.type === "string" && typeof rec.message !== "string") {
        return rec.type;
      }
    }
    if (e.message?.trim()) return e.message.trim();
  }

  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/** HTTP status from SDK / fetch error when present (Medusa Admin 4xx/5xx). */
function medusaSdkErrorHttpStatus(e: unknown): number | undefined {
  const any = e as {
    status?: number;
    response?: { status?: number };
    cause?: { status?: number };
  };
  return (
    any.status ??
    any.response?.status ??
    (any.cause as { status?: number } | undefined)?.status
  );
}

/**
 * Prefer forwarding Medusa client errors (4xx) as 400; keep 502 for gateway / unknown failures.
 */
export function commerceFailureHttpStatus(e: unknown): number {
  const s = medusaSdkErrorHttpStatus(e);
  if (typeof s === "number" && s >= 400 && s < 500) return 400;
  if (s === 502 || s === 503 || s === 504) return s;
  return 502;
}
