import pg from "pg";

import { logWebhookDedupDuplicate } from "./webhook-dedup-metrics.js";
import { recordWebhookSecurityEvent } from "./webhook-security-metrics";

let pool: pg.Pool | null = null;
let tableEnsured = false;

function getPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (!pool) pool = new pg.Pool({ connectionString: url, max: 3 });
  return pool;
}

async function ensureTable(p: pg.Pool): Promise<void> {
  if (tableEnsured) return;
  await p.query(`
    CREATE TABLE IF NOT EXISTS stripe_webhook_dedup (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  tableEnsured = true;
}

/** Stripe event ids are unique per delivery; reuse blocks webhook retries from double-applying. */
export function buildStripeWebhookDedupId(event: {
  id: string;
  type: string;
}): string | null {
  if (!event.id?.trim()) return null;
  return `stripe:${event.type}:${event.id}`;
}

export async function claimStripeWebhookDedup(dedupId: string): Promise<boolean> {
  if (!dedupId.length) return true;
  const p = getPool();
  if (!p) {
    console.warn(
      "[stripe-dedup] DATABASE_URL not set, rejecting to prevent duplicate processing",
    );
    return false;
  }
  await ensureTable(p);
  const res = await p.query(
    `INSERT INTO stripe_webhook_dedup (id) VALUES ($1) ON CONFLICT (id) DO NOTHING RETURNING id`,
    [dedupId],
  );
  const first = (res.rowCount ?? 0) >= 1;
  if (!first) {
    logWebhookDedupDuplicate("stripe", dedupId);
    await recordWebhookSecurityEvent("stripe", "dedup_duplicate");
  }
  return first;
}
