export type ResendEmailInput = {
  apiKey: string;
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  tags?: Array<{ name: string; value: string }>;
  idempotencyKey?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
};

export type ResendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; message: string };

export async function sendResendTransactionalEmail(
  input: ResendEmailInput,
): Promise<ResendEmailResult> {
  const maxAttempts = Math.max(1, Math.min(input.maxAttempts ?? 3, 3));
  const timeoutMs = Math.max(1_000, input.timeoutMs ?? 10_000);
  const retryDelayMs = Math.max(0, input.retryDelayMs ?? 250);
  const payload = JSON.stringify({
    from: input.from.trim().replace(/^<|>$/g, ""),
    to: input.to,
    subject: input.subject,
    html: input.html,
    ...(input.tags?.length ? { tags: input.tags } : {}),
  });

  let lastMessage = "Resend request failed";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
          ...(input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : {}),
        },
        body: payload,
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
      };
      if (response.ok) return { ok: true, id: body.id };

      lastMessage = body.message?.trim() || `Resend returned HTTP ${response.status}`;
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      if (!retryable || attempt === maxAttempts) {
        return { ok: false, message: lastMessage };
      }
    } catch (error) {
      lastMessage = error instanceof Error && error.name === "AbortError"
        ? `Resend request timed out after ${timeoutMs}ms`
        : "Resend request failed";
      if (attempt === maxAttempts) return { ok: false, message: lastMessage };
    } finally {
      clearTimeout(timeout);
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
  }

  return { ok: false, message: lastMessage };
}
