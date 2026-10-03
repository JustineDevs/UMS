import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", override: true });

const { Client } = pg;
const connectionString = process.env.APP_DB_URL;
if (!connectionString) throw new Error("APP_DB_URL missing");

const probe = `__codex_c631_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const options = { connectionString, connectionTimeoutMillis: 10_000, query_timeout: 15_000 };
const lookup = new Client(options);
await lookup.connect();
const customerResult = await lookup.query(
  "SELECT medusa_customer_id FROM public.wishlists WHERE medusa_customer_id IS NOT NULL LIMIT 1",
);
await lookup.end();

const customerId = customerResult.rows[0]?.medusa_customer_id;
if (!customerId) {
  console.log(JSON.stringify({ skipped: true, reason: "no_existing_wishlist_customer" }));
  process.exit(0);
}

const firstClient = new Client(options);
const secondClient = new Client(options);
const cleanupClient = new Client(options);
const insert = `
  INSERT INTO public.wishlists
    (medusa_customer_id, product_slug, product_name, medusa_product_id)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (medusa_customer_id, medusa_product_id)
    WHERE medusa_product_id IS NOT NULL
  DO NOTHING
  RETURNING id
`;

try {
  await Promise.all([firstClient.connect(), secondClient.connect(), cleanupClient.connect()]);
  await firstClient.query("BEGIN");
  await secondClient.query("BEGIN");
  const firstInsert = firstClient.query(insert, [customerId, probe, "Codex C6-31 probe", probe]);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const secondInsert = secondClient.query(insert, [customerId, probe, "Codex C6-31 probe", probe]);
  await firstClient.query("COMMIT");
  const [firstResult, secondResult] = await Promise.all([firstInsert, secondInsert]);
  await secondClient.query("COMMIT");
  const count = await cleanupClient.query(
    "SELECT count(*)::int AS count FROM public.wishlists WHERE medusa_customer_id=$1 AND medusa_product_id=$2",
    [customerId, probe],
  );
  await cleanupClient.query(
    "DELETE FROM public.wishlists WHERE medusa_customer_id=$1 AND medusa_product_id=$2",
    [customerId, probe],
  );
  console.log(JSON.stringify({
    skipped: false,
    firstInserted: firstResult.rowCount,
    secondInserted: secondResult.rowCount,
    finalRows: count.rows[0]?.count,
    cleaned: true,
  }));
} catch (error) {
  await firstClient.query("ROLLBACK").catch(() => undefined);
  await secondClient.query("ROLLBACK").catch(() => undefined);
  await cleanupClient.query(
    "DELETE FROM public.wishlists WHERE medusa_customer_id=$1 AND medusa_product_id=$2",
    [customerId, probe],
  ).catch(() => undefined);
  throw error;
} finally {
  await Promise.all([
    firstClient.end().catch(() => undefined),
    secondClient.end().catch(() => undefined),
    cleanupClient.end().catch(() => undefined),
  ]);
}
