type StripeCheckoutSession = {
  amount_total?: number | null;
  currency?: string | null;
  payment_status?: string | null;
  status?: string | null;
};

export async function isPaidStripeCheckoutSession(input: {
  sessionId: string;
  amountMinor?: number | null;
  currency?: string | null;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const sessionId = input.sessionId.trim();
  const apiKey = input.apiKey?.trim();
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId) || !apiKey) return false;

  const response = await (input.fetchImpl ?? fetch)(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    },
  );
  if (!response.ok) return false;
  const session = (await response.json().catch(() => null)) as StripeCheckoutSession | null;
  return session?.payment_status === "paid" &&
    session.status === "complete" &&
    typeof input.amountMinor === "number" &&
    session.amount_total === input.amountMinor &&
    typeof input.currency === "string" &&
    session.currency?.toLowerCase() === input.currency.toLowerCase();
}
