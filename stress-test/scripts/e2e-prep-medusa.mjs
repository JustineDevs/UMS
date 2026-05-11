#!/usr/bin/env node
/**
 * Ensures Medusa has demo catalog + PH region for Playwright. Idempotent:
 * if the store API already returns at least one product for the configured region,
 * seed steps are skipped (no duplicate seed runs).
 *
 * Requires apps/medusa/.env (DATABASE_URL) when seed runs. For the HTTP probe,
 * Medusa must be listening (e.g. pnpm --filter medusa dev); if the probe cannot
 * run, falls through to `medusa exec` seed (works with Medusa stopped).
 *
 * Usage:
 *   node stress-test/scripts/e2e-prep-medusa.mjs
 *   node stress-test/scripts/e2e-prep-medusa.mjs --force   # always run seed + seed:ph
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { attach } from "./lib/runtime-log-tee.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
attach(import.meta.url);

try {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
  dotenv.config({ path: path.resolve(__dirname, "../../.env.local"), override: true });
} catch {
  /* dotenv optional */
}

const root = path.resolve(__dirname, "../..");
const force = process.argv.includes("--force");

function medusaBaseUrl() {
  const u =
    process.env.MEDUSA_BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_MEDUSA_URL?.trim() ||
    "";
  return u.replace(/\/$/, "");
}

function publishableKey() {
  return (
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY?.trim() ||
    process.env.MEDUSA_PUBLISHABLE_API_KEY?.trim() ||
    ""
  );
}

function regionId() {
  return (
    process.env.NEXT_PUBLIC_MEDUSA_REGION_ID?.trim() ||
    process.env.MEDUSA_REGION_ID?.trim() ||
    ""
  );
}

function salesChannelId() {
  return (
    process.env.MEDUSA_SALES_CHANNEL_ID?.trim() ||
    process.env.NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID?.trim() ||
    ""
  );
}

async function storeAlreadyHasProducts() {
  const base = medusaBaseUrl();
  const key = publishableKey();
  const region = regionId();
  if (!base || !key || !region) {
    console.log(
      "[e2e-prep-medusa] Skip probe: set MEDUSA_BACKEND_URL or NEXT_PUBLIC_MEDUSA_URL, publishable key, and MEDUSA_REGION_ID in root .env to enable skip-when-ready.",
    );
    return false;
  }
  const sc = salesChannelId();
  const qs = new URLSearchParams({
    limit: "1",
    region_id: region,
    fields: "id,*variants",
  });
  if (sc) {
    qs.set("sales_channel_id", sc);
  }
  const url = `${base}/store/products?${qs.toString()}`;
  try {
    const res = await fetch(url, {
      headers: { "x-publishable-api-key": key },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.log(`[e2e-prep-medusa] Store probe HTTP ${res.status}, will run seed.`);
      return false;
    }
    const json = await res.json();
    const products = json?.products;
    const first = Array.isArray(products) ? products[0] : undefined;
    const hasVariant =
      first?.variants &&
      Array.isArray(first.variants) &&
      first.variants.length > 0;
    if (hasVariant) {
      console.log(
        `[e2e-prep-medusa] Store already lists product(s) with variants for this region/channel; skipping medusa seed and seed:ph.`,
      );
      return true;
    }
    console.log(
      "[e2e-prep-medusa] Store returned no usable variants for this region/channel; will run seed.",
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(
      `[e2e-prep-medusa] Store probe failed (${msg}); running medusa exec seed (server may be down).`,
    );
  }
  return false;
}

function run(label, args) {
  console.log(`\n━━━ ${label} ━━━\n`);
  const r = spawnSync("pnpm", args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env },
  });
  if (r.status !== 0) {
    console.error(`\n${label} failed (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
}

async function main() {
  if (!force) {
    const ready = await storeAlreadyHasProducts();
    if (ready) {
      console.log("\nMedusa E2E prep: already satisfied (catalog present).\n");
      return;
    }
  } else {
    console.log("\n[e2e-prep-medusa] --force: running seed regardless of store probe.\n");
  }

  run("medusa seed (demo catalog)", ["--filter", "medusa", "run", "seed"]);
  run("medusa seed:ph (Philippines region + keys)", ["--filter", "medusa", "run", "seed:ph"]);
  console.log("\nMedusa E2E prep finished.\n");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
