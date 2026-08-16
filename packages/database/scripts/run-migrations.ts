/**
 * Legacy Supabase / platform Postgres migrations (NOT Medusa `DATABASE_URL`).
 *
 * Medusa-style behavior:
 * - Each file in MIGRATION_FILES runs at most once per database.
 * - Applied filenames are recorded in `public.legacy_platform_schema_migrations`.
 * - New database: empty ledger, every file runs in order inside a transaction.
 * - Existing database (first use of this runner): empty ledger, all files run once;
 *   SQL is idempotent (`IF NOT EXISTS`, `DROP IF EXISTS`, etc.) where possible.
 * - Subsequent runs: only pending files run.
 * ` pnpm --filter @universal-music-store/database migrate`
 * Append new `supabase/migrations/*.sql` names to MIGRATION_FILES in numeric order.
 * Uses LEGACY_DATABASE_URL from repo root `.env.local`.
 *
 * Flags:
 *   --status   List applied vs pending and exit (exit 1 if any pending).
 *
 * Supabase CLI alternative: `pnpm --filter @universal-music-store/database migrate:cli`
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../../");
config({ path: join(repoRoot, ".env.local"), override: true });

const MIGRATION_FILES = [
  "002_staff_permissions.sql",
  "003_platform_integrations.sql",
  "004_retail_operations.sql",
  "005_storefront_home_cms.sql",
  "006_cms_platform.sql",
  "007_admin_workflow_operator.sql",
  "008_storefront_reviews_cart.sql",
  "009_medusa_reference_columns.sql",
  "010_pos_offline_commit_idempotency.sql",
  "011_storefront_public_metadata.sql",
  "012_product_reviews_moderation.sql",
  "013_drop_legacy_payment_connections.sql",
  "015_drop_accidental_medusa_core_tables_from_legacy.sql",
  "016_platform_rls_authenticated_denies.sql",
  "018_outbox_events.sql",
  "019_background_jobs.sql",
  "020_storefront_profiles_product_qa.sql",
  "021_cms_content_navigation_expansion.sql",
  "022_cms_sprint_extensions.sql",
  "023_payment_attempts_and_webhook_inbox.sql",
  "024_payment_ops_audit_outbox_job_columns.sql",
  "025_catalog_storage_bucket.sql",
  "026_payment_attempt_quote_fingerprint_and_staleness.sql",
  "027_payment_attempt_quote_version.sql",
  "028_inventory_movements_append_only.sql",
  "029_back_in_stock_notifications.sql",
  "030_require_medusa_order_id_receipts_voids.sql",
  "031_cart_abandonment_dedup_constraint.sql",
  "032_wishlists_server_sync.sql",
  "033_product_reviews_helpful_votes.sql",
  "034_staff_customer_notes.sql",
  "035_payment_receipts.sql",
  "036_cms_payment_links.sql",
  "037_rebuild_cms_payment_links.sql",
  "038_return_refund_reason_registry.sql",
  "039_reviews_and_profiles_images.sql",
  "040_catalog_provider_projections.sql",
  "041_crm_nango_mappings.sql",
  "042_crm_nango_connections_and_records.sql",
  "043_delivery_logistics_ledger.sql",
  "044_crm_delivery_operations.sql",
  "045_payment_nango_connections.sql",
  "046_admin_security_hardening.sql",
  "047_pos_logistics_channel_enterprise.sql",
  "048_admin_invoices.sql",
  "049_payment_provider_lifecycle.sql",
  "050_receipt_idempotency.sql",
  "051_organizations_memberships.sql",
  "052_tenant_scope_financial_records.sql",
  "053_replay_guards.sql",
  "054_inventory_audit_tenant.sql",
  "055_crm_tenant_scope.sql",
  "056_chat_order_tenant_scope.sql",
  "057_campaign_segment_tenant_scope.sql",
  "058_marketing_preferences.sql",
  "059_pos_tenant_scope.sql",
  "060_pos_shift_tenant_scope.sql",
  "061_payment_invoice_artifact.sql",
  "063_inventory_reservation_lifecycle.sql",
  "063_payment_reconciliation_job_dedupe.sql",
  "063_pos_terminal_provider_artifact_mapping.sql",
  "064_pos_sale_ledger.sql",
  "065_admin_workflow_tenant_scope.sql",
  "066_cms_pages_tenant_scope.sql",
  "067_invoice_reference_tenant_scope.sql",
  "068_crm_nango_mapping_tenant_scope.sql",
  "069_invoice_provider_lifecycle.sql",
  "070_inventory_operations.sql",
  "071_chat_order_settlement.sql",
  "072_membership_user_identity.sql",
  "075_cms_component_lifecycle.sql",
  "076_cms_experiment_media_tenant_scope.sql",
  "077_device_payment_attempt_tenant_scope.sql",
  "078_cms_core_tenant_scope.sql",
  "079_cms_legacy_composite_tenant_keys.sql",
  "080_cms_announcement_analytics_tenant.sql",
  "081_cms_component_definition_transaction.sql",
  "082_cms_block_presets_tenant_scope.sql",
  "083_cms_payment_links_tenant_scope.sql",
  "085_review_helpful_atomic_increment.sql",
  "086_payment_attempt_finalize_claim.sql",
  "087_cms_pages_canonical_tree.sql",
  "088_payment_attempt_stale_claim_recovery.sql",
  "089_newsletter_double_opt_in.sql",
  "090_cms_page_mutations.sql",
  "091_cms_tenant_constraints.sql",
  "092_review_helpful_vote_identity.sql",
  "093_public_delivery_attempts.sql",
  "094_cms_remaining_tenant_constraints.sql",
  "enable_rls.sql",
  "rls_deny_anon_sensitive.sql",
] as const;

const MIGRATIONS_TABLE = "legacy_platform_schema_migrations";

const databaseUrl = process.env.LEGACY_DATABASE_URL;
if (!databaseUrl?.trim()) {
  console.error(
    "LEGACY_DATABASE_URL is required (Supabase Postgres pooler URI).",
  );
  console.error(
    "Set it in the repo root .env.local (see .env.example). Not the same as Medusa DATABASE_URL.",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const statusOnly = args.includes("--status");

function switchPoolerPort(url: string, port: number): string {
  try {
    const u = new URL(url);
    u.port = String(port);
    return u.toString();
  } catch {
    return url;
  }
}

async function connectWithPoolerFallback(): Promise<{
  client: pg.Client;
  url: string;
}> {
  const tryConnect = async (url: string) => {
    const client = new pg.Client({
      connectionString: url,
      connectionTimeoutMillis: 20_000,
    });
    await client.connect();
    return client;
  };

  try {
    const client = await tryConnect(databaseUrl!);
    return { client, url: databaseUrl! };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!databaseUrl!.includes("pooler.supabase.com")) {
      throw err;
    }
    const currentPort = new URL(databaseUrl!).port;
    const altPort = currentPort === "5432" ? "6543" : "5432";
    const altUrl = switchPoolerPort(databaseUrl!, Number(altPort));
    console.log(
      `Primary pooler (${currentPort}) failed (${msg}). Trying port ${altPort}...`,
    );
    const client = await tryConnect(altUrl);
    return { client, url: altUrl };
  }
}

async function ensureMigrationsTable(client: pg.Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.${MIGRATIONS_TABLE} (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await client.query(`
    COMMENT ON TABLE public.${MIGRATIONS_TABLE} IS
      'Applied platform SQL migrations from packages/database (pnpm migrate). Separate from Medusa mikro_orm_migrations.';
  `);
}

async function getAppliedSet(client: pg.Client): Promise<Set<string>> {
  const { rows } = await client.query<{ filename: string }>(
    `SELECT filename FROM public.${MIGRATIONS_TABLE}`,
  );
  return new Set(rows.map((r) => r.filename));
}

async function printStatusAndExit(
  client: pg.Client,
  applied: Set<string>,
): Promise<never> {
  const defined = new Set<string>(MIGRATION_FILES);
  const pending = MIGRATION_FILES.filter((f) => !applied.has(f));
  const appliedInOrder = MIGRATION_FILES.filter((f) => applied.has(f));
  const orphan = [...applied].filter((f) => !defined.has(f));

  console.log(`Migrations table: public.${MIGRATIONS_TABLE}`);
  console.log(`Total defined in runner: ${MIGRATION_FILES.length}`);
  console.log(`Applied (known files): ${appliedInOrder.length}`);
  if (orphan.length > 0) {
    console.warn(
      `Orphan rows in ledger (not in MIGRATION_FILES; remove manually if stale): ${orphan.join(", ")}`,
    );
  }
  if (pending.length === 0) {
    console.log("Pending: none");
    await client.end();
    process.exit(0);
  }
  console.log(`Pending (${pending.length}):`);
  for (const p of pending) {
    console.log(`  - ${p}`);
  }
  await client.end();
  process.exit(1);
}

async function main(): Promise<void> {
  const { client } = await connectWithPoolerFallback();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedSet(client);

    if (statusOnly) {
      await printStatusAndExit(client, applied);
    }

    const dir = join(__dirname, "..", "supabase", "migrations");
    let ran = 0;
    for (const name of MIGRATION_FILES) {
      if (applied.has(name)) {
        console.log(`skip ${name} (already applied)`);
        continue;
      }
      const sqlPath = join(dir, name);
      const sql = readFileSync(sqlPath, "utf-8");
      process.stdout.write(`Applying ${name}... `);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO public.${MIGRATIONS_TABLE} (filename) VALUES ($1)`,
          [name],
        );
        await client.query("COMMIT");
        console.log("ok");
        ran += 1;
      } catch (e) {
        await client.query("ROLLBACK");
        console.log("failed");
        throw e;
      }
    }
    if (ran === 0) {
      console.log("No pending migrations.");
    } else {
      console.log(`Applied ${ran} migration(s).`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
