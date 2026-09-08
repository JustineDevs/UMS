/**
 * Channel webhook ingestion must not accept unsigned traffic on any deployment.
 * Local development is the only exception; Vercel preview also sets NODE_ENV=production.
 */
export type ChannelWebhookGate =
  | { ok: true }
  | { ok: false; status: 503; error: string };

export function gateChannelWebhookSecretConfigured(
  secret: string | undefined,
  vercelEnv: string | undefined,
  nodeEnv: string | undefined,
): ChannelWebhookGate {
  const trimmed = secret?.trim();
  const localDevelopment = nodeEnv === "development" && (!vercelEnv || vercelEnv === "development");
  const strict = !localDevelopment;
  if (strict && !trimmed) {
    return {
      ok: false,
      status: 503,
      error:
        "CHANNEL_WEBHOOK_SECRET is required for channel webhooks in this environment.",
    };
  }
  return { ok: true };
}
