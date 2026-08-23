import pg from "pg";

export type WebhookSecurityEvent = "signature_failure" | "dedup_duplicate";

let pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  pool ??= new pg.Pool({ connectionString: url, max: 3 });
  return pool;
}

/** Best-effort telemetry: rejecting a webhook must never depend on the metrics write. */
export async function recordWebhookSecurityEvent(
  provider: string,
  event: WebhookSecurityEvent,
): Promise<void> {
  const client = getPool();
  if (!client) return;
  try {
    await client.query(
      `INSERT INTO payment_webhook_security_events (provider, event_type)
       VALUES ($1, $2)`,
      [provider, event],
    );
  } catch (error) {
    console.warn("[payment-webhook] security metric write failed", {
      provider,
      event,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
