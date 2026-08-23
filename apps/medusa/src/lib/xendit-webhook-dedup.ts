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
    CREATE TABLE IF NOT EXISTS xendit_webhook_dedup (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  tableEnsured = true;
}

export function buildXenditWebhookDedupId(body: Record<string, unknown>): string | null {
  const data = body.data as
    | {
        id?: string;
        payment_request_id?: string;
        payment_id?: string;
      }
    | undefined;
  const event = String(body.event ?? body.type ?? "unknown").trim() || "unknown";
  const key = data?.id ?? data?.payment_request_id ?? data?.payment_id;
  if (!key) return null;
  return `xendit:${event}:${key}`;
}

export async function claimXenditWebhookDedup(dedupId: string): Promise<boolean> {
  if (!dedupId.length) return true;
  const p = getPool();
  if (!p) {
    console.warn(
      "[xendit-dedup] DATABASE_URL not set — rejecting webhook to prevent duplicate processing",
    );
    return false;
  }
  await ensureTable(p);
  const res = await p.query(
    `INSERT INTO xendit_webhook_dedup (id) VALUES ($1) ON CONFLICT (id) DO NOTHING RETURNING id`,
    [dedupId],
  );
  const first = (res.rowCount ?? 0) >= 1;
  if (!first) {
    logWebhookDedupDuplicate("xendit", dedupId);
    await recordWebhookSecurityEvent("xendit", "dedup_duplicate");
  }
  return first;
}
