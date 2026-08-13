export type ResendEmailInput = {
  apiKey: string;
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  tags?: Array<{ name: string; value: string }>;
  idempotencyKey?: string;
};

export type ResendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; message: string };

export async function sendResendTransactionalEmail(
  input: ResendEmailInput,
): Promise<ResendEmailResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      ...(input.idempotencyKey
        ? { "Idempotency-Key": input.idempotencyKey }
        : {}),
    },
    body: JSON.stringify({
      from: input.from.trim().replace(/^<|>$/g, ""),
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.tags?.length ? { tags: input.tags } : {}),
    }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };
  if (!response.ok) {
    return {
      ok: false,
      message: body.message?.trim() || `Resend returned HTTP ${response.status}`,
    };
  }
  return { ok: true, id: body.id };
}
