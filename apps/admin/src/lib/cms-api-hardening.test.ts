import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function repoRoot(): string {
  let current = here;
  while (current !== dirname(current)) {
    if (existsSync(join(current, "apps", "admin", "package.json"))) return current;
    current = dirname(current);
  }
  throw new Error("Repository root not found");
}

function filesUnder(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

test("every CMS mutation export uses the shared idempotent admin boundary", () => {
  const root = resolve(repoRoot(), "apps/admin/src/app/api/admin/cms");
  const mutationFiles = filesUnder(root).filter((path) =>
    /export const (POST|PUT|PATCH|DELETE)\s*=/.test(readFileSync(path, "utf8")),
  );

  assert.ok(mutationFiles.length > 0);
  for (const path of mutationFiles) {
    const source = readFileSync(path, "utf8");
    assert.match(
      source,
      /withAdminMutationIdempotency/,
      `${path} is a CMS mutation without the shared auth/tenant/idempotency boundary`,
    );
  }
});

test("internal and cron storefront routes require service authentication and redact failures", () => {
  const root = resolve(repoRoot(), "apps/storefront/src/app/api");
  const protectedRoots = [join(root, "internal"), join(root, "cron")];
  const routes = protectedRoots.flatMap(filesUnder);

  assert.ok(routes.length > 0);
  for (const path of routes) {
    const source = readFileSync(path, "utf8");
    assert.match(
      source,
      /CRON_SECRET|_CRON_SECRET|x-cron-secret|x-internal-secret/,
      `${path} has no service-secret authentication contract`,
    );
    assert.doesNotMatch(
      source,
      /NextResponse\.json\(\{\s*error:\s*message\s*\}/,
      `${path} exposes a caught exception directly to callers`,
    );
  }
});

test("the final CMS tenant migration closes nullable ownership gaps", () => {
  const migration = readFileSync(
    resolve(repoRoot(), "packages/database/supabase/migrations/094_cms_remaining_tenant_constraints.sql"),
    "utf8",
  );
  for (const table of [
    "cms_ab_experiments",
    "cms_media",
    "cms_page_block_presets",
    "cms_payment_links",
    "cms_announcement_analytics",
    "cms_page_mutations",
  ]) {
    assert.match(migration, new RegExp(`${table}.*organization_id`, "s"));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ALTER COLUMN organization_id SET NOT NULL`));
    assert.match(migration, new RegExp(`REFERENCES public\\.organizations\\(id\\)`));
  }
});
