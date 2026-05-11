import pg from "pg";

import { logWebhookDedupDuplicate } from "./webhook-dedup-metrics.js";

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
    CREATE TABLE IF NOT EXISTS jnt_webhook_dedup (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  tableEnsured = true;
}

export function buildJntWebhookDedupId(
  orderId: string,
  status: string | undefined,
  payloadHash: string | undefined,
): string {
  return `jnt:${orderId}:${status ?? "unknown"}:${payloadHash ?? "nohash"}`;
}

export async function claimJntWebhookDedup(dedupId: string): Promise<boolean> {
  if (!dedupId.length) return true;
  const p = getPool();
  if (!p) {
    console.warn("[jnt-dedup] DATABASE_URL not set — webhook deduplication unavailable");
    throw new Error("JNT_DEDUP_UNAVAILABLE");
  }
  await ensureTable(p);
  const res = await p.query(
    `INSERT INTO jnt_webhook_dedup (id) VALUES ($1) ON CONFLICT (id) DO NOTHING RETURNING id`,
    [dedupId],
  );
  const first = (res.rowCount ?? 0) >= 1;
  if (!first) {
    logWebhookDedupDuplicate("jnt", dedupId);
  }
  return first;
}

export async function releaseJntWebhookDedup(dedupId: string): Promise<void> {
  if (!dedupId.length) return;
  const p = getPool();
  if (!p) return;
  await ensureTable(p);
  await p.query(`DELETE FROM jnt_webhook_dedup WHERE id = $1`, [dedupId]);
}
