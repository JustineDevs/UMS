import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(__dirname, "../../../");
config({ path: join(repoRoot, ".env.local"), override: true });

/** Legacy/app Postgres only — never Medusa’s DATABASE_URL (see apps/medusa/.env.local). */
const databaseUrl = process.env.LEGACY_DATABASE_URL;
if (!databaseUrl) {
  console.error(
    "LEGACY_DATABASE_URL is required (legacy Supabase pooler URI for this schema).",
  );
  process.exit(1);
}

function switchPoolerPort(url: string, port: number): string {
  try {
    const u = new URL(url);
    u.port = String(port);
    return u.toString();
  } catch {
    return url;
  }
}

const sql = readFileSync(join(__dirname, "../supabase/seed.sql"), "utf-8");

async function runSeed(connectionString: string): Promise<void> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  await client.query(sql);
  await client.end();
}

async function main(): Promise<void> {
  try {
    await runSeed(databaseUrl);
    console.log("Seed completed.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (databaseUrl.includes("pooler.supabase.com")) {
      const currentPort = new URL(databaseUrl).port;
      const altPort = currentPort === "5432" ? 6543 : 5432;
      const altUrl = switchPoolerPort(databaseUrl, altPort);
      console.log(
        `Session pooler (${currentPort}) failed, trying transaction pooler (${altPort})...`,
      );
      try {
        await runSeed(altUrl);
        console.log(`Seed completed (port ${altPort}).`);
        return;
      } catch (e) {
        console.error(
          `Port ${altPort} also failed:`,
          e instanceof Error ? e.message : e,
        );
      }
    }
    console.error("Seed failed:", msg);
    process.exit(1);
  }
}

main();
