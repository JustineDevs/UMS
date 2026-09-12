import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../../");
config({ path: join(repoRoot, ".env.local"), override: true });

/** Application/platform Postgres only — never Medusa’s MEDUSA_DB_URL. */
const databaseUrl = process.env.APP_DB_URL;
if (!databaseUrl) {
  console.error(
    "APP_DB_URL is required (application/platform Supabase pooler URI for this schema).",
  );
  process.exit(1);
}

const relativeSqlPath = process.argv[2];
if (!relativeSqlPath) {
  console.error("Usage: tsx scripts/apply-sql.ts <path-to.sql>");
  process.exit(1);
}

const sqlPath = resolve(__dirname, "..", relativeSqlPath);
const sql = readFileSync(sqlPath, "utf-8");

function switchPoolerPort(url: string, port: number): string {
  try {
    const u = new URL(url);
    u.port = String(port);
    return u.toString();
  } catch {
    return url;
  }
}

function isSupabasePooler(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "pooler.supabase.com" || hostname.endsWith(".pooler.supabase.com");
  } catch {
    return false;
  }
}

async function runOnce(connectionString: string): Promise<void> {
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 20_000,
  });
  await client.connect();
  await client.query(sql);
  await client.end();
}

async function main(): Promise<void> {
  try {
    await runOnce(databaseUrl);
    console.log(`Applied: ${relativeSqlPath}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isSupabasePooler(databaseUrl)) {
      const currentPort = new URL(databaseUrl).port;
      const altPort = currentPort === "5432" ? 6543 : 5432;
      const altUrl = switchPoolerPort(databaseUrl, altPort);
      console.log(
        `Primary pooler (${currentPort}) failed (${msg}). Trying ${altPort}...`,
      );
      await runOnce(altUrl);
      console.log(`Applied: ${relativeSqlPath} (port ${altPort})`);
      return;
    }
    console.error(err);
    process.exit(1);
  }
}

main();
