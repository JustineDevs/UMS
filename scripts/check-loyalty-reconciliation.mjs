#!/usr/bin/env node
/**
 * PH-22: Loyalty balance reconciliation check.
 *
 * Validates that all loyalty_accounts.points_balance values match the sum of
 * their loyalty_transactions.points_delta rows (Supabase is the single ledger).
 * Reports any divergence and exits non-zero if drift is found.
 *
 * Run locally or in CI staging:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/check-loyalty-reconciliation.mjs
 *
 * Architecture decision (PH-22):
 *   - Supabase loyalty_accounts.points_balance is the canonical balance.
 *   - Medusa order metadata carries loyalty_points_redeemed for order-time
 *     reference ONLY (read at subscriber time, never written back).
 *   - There is no parallel Medusa loyalty ledger.
 */
const { createClient } = await import("@supabase/supabase-js");
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  const envPath = join(__dirname, "..", ".env.local");
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* .env.local not present */
}

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.log(
    "[loyalty-recon] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Skipping check.",
  );
  process.exit(0);
}

const sb = createClient(url, key);

const { data: accounts, error: acctErr } = await sb
  .from("loyalty_accounts")
  .select("id, customer_email, points_balance")
  .limit(10000);

if (acctErr) {
  console.error("[loyalty-recon] Failed to fetch accounts:", acctErr.message);
  process.exit(1);
}

if (!accounts || accounts.length === 0) {
  console.log(
    "[loyalty-recon] No loyalty accounts found. Skipping reconciliation.",
  );
  process.exit(0);
}

const { data: txns, error: txnErr } = await sb
  .from("loyalty_transactions")
  .select("loyalty_account_id, points_delta")
  .limit(100000);

if (txnErr) {
  console.error(
    "[loyalty-recon] Failed to fetch transactions:",
    txnErr.message,
  );
  process.exit(1);
}

const ledger = new Map();
for (const t of txns ?? []) {
  const prev = ledger.get(t.loyalty_account_id) ?? 0;
  ledger.set(t.loyalty_account_id, prev + Number(t.points_delta ?? 0));
}

let driftCount = 0;
for (const acct of accounts) {
  const computed = ledger.get(acct.id) ?? 0;
  const stored = Number(acct.points_balance ?? 0);
  if (computed !== stored) {
    console.error(
      `[loyalty-recon] DRIFT account=${acct.id} email=${acct.customer_email} ` +
        `stored=${stored} computed=${computed} diff=${stored - computed}`,
    );
    driftCount++;
  }
}

if (driftCount === 0) {
  console.log(
    `[loyalty-recon] OK: ${accounts.length} accounts, all balances match transaction ledger.`,
  );
  process.exit(0);
} else {
  console.error(
    `[loyalty-recon] FAIL: ${driftCount} accounts have diverged balances.`,
  );
  process.exit(1);
}
