import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  POLICY_EFFECTIVE_DATE,
  POLICY_LAST_UPDATED,
  POLICY_VERSION,
} from "./policy-content";

test("public policy metadata is explicit and versioned", () => {
  assert.match(POLICY_VERSION, /^\d{4}\.\d{2}$/);
  assert.match(POLICY_EFFECTIVE_DATE, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(POLICY_LAST_UPDATED.length > 0);
});

test("every public policy route renders the shared version marker", async () => {
  const workspace = process.cwd().endsWith("/apps/web")
    ? process.cwd()
    : resolve(process.cwd(), "apps/web");
  const root = resolve(workspace, "src/app/(public)");
  for (const route of ["shipping", "returns", "terms", "privacy", "cookies", "accessibility"]) {
    const source = await readFile(resolve(root, route, "page.tsx"), "utf8");
    assert.match(source, /PolicyMeta/);
  }
});
