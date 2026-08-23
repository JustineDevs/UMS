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
    CREATE TABLE IF NOT EXISTS paypal_webhook_dedup (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  tableEnsured = true;
}

export function buildPayPalWebhookDedupId(
  body: Record<string, unknown>,
): string | null {
  const id = body.id as string | undefined;
  const eventType = body.event_type as string | undefined;
  if (!id) return null;
  return `paypal:${eventType ?? "unknown"}:${id}`;
}

export async function claimPayPalWebhookDedup(
  dedupId: string,
): Promise<boolean> {
  if (!dedupId.length) return true;
  const p = getPool();
  if (!p) {
    console.warn(
      "[paypal-dedup] DATABASE_URL not set, rejecting to prevent duplicates",
    );
    return false;
  }
  await ensureTable(p);
  const res = await p.query(
    `INSERT INTO paypal_webhook_dedup (id) VALUES ($1) ON CONFLICT (id) DO NOTHING RETURNING id`,
    [dedupId],
  );
  const first = (res.rowCount ?? 0) >= 1;
  if (!first) {
    logWebhookDedupDuplicate("paypal", dedupId);
    await recordWebhookSecurityEvent("paypal", "dedup_duplicate");
  }
  return first;
}
