#!/usr/bin/env node
/**
 * Fails if a Supabase migration introduces parallel commerce tables that belong in Medusa
 * (orders, carts, products, inventory, payment sessions, etc.).
 *
 * Medusa DB = commerce of record. Supabase = platform + bridges only.
 * @see packages/database/src/data-boundaries.ts
 */
import fs from "node:fs";
import path from "node:path";
import { attach } from "./lib/runtime-log-tee.mjs";

attach(import.meta.url);

const dir = path.join(
  process.cwd(),
  "packages",
  "database",
  "supabase",
  "migrations",
);

/** Match `create table [if not exists] [public.]name (` — name must not mirror Medusa core entities. */
const forbidden = [
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?orders\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?order\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?carts\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?cart\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?line_items\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?line_item\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?products\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?product\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?variants\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?variant\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?payment_session\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?payment_collection\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?inventory_item\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?inventory_level\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?stock_location\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?fulfillment\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?fulfillments\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?regions\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?region\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?sales_channels\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?sales_channel\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?customers\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?customer\s*\(/i,
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?price_list\s*\(/i,
];

let failed = false;
for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith(".sql")) continue;
  const p = path.join(dir, name);
  const text = fs.readFileSync(p, "utf8");
  for (const re of forbidden) {
    if (re.test(text)) {
      console.error(
        `[migration-boundary] ${name} matches forbidden Medusa-commerce table pattern ${re}`,
      );
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}
console.log(
  "[migration-boundary] no forbidden parallel commerce tables in Supabase migrations",
);
