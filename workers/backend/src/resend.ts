const RESEND_TIMEOUT_MS = 10_000;
const RESEND_MAX_RESPONSE_BYTES = 64 * 1024;

export type ResendSendInput = {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  idempotencyKey?: string;
  fetchImpl?: typeof fetch;
};

export async function sendResendEmail(input: ResendSendInput): Promise<{ ok: boolean; status: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);
  const headers: Record<string, string> = { Authorization: `Bearer ${input.apiKey.trim()}`, "Content-Type": "application/json", Accept: "application/json" };
  if (input.idempotencyKey) headers["Idempotency-Key"] = input.idempotencyKey;
  try {
    const response = await (input.fetchImpl ?? fetch)("https://api.resend.com/emails", {
      method: "POST", headers, body: JSON.stringify({ from: input.from, to: input.to, subject: input.subject, html: input.html }), signal: controller.signal,
    });
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > RESEND_MAX_RESPONSE_BYTES) return { ok: false, status: 502 };
    const body = await response.arrayBuffer();
    if (body.byteLength > RESEND_MAX_RESPONSE_BYTES) return { ok: false, status: 502 };
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 503 };
  } finally {
    clearTimeout(timeout);
  }
}
