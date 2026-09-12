import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { getPublishedNavigation, handleNavigationRequest } from "./navigation.ts";

function database(rows: Record<string, unknown>[]): WorkerDatabaseClient {
  return {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      assert.match(text, /organization_id = \$1/);
      assert.deepEqual(values, ["org_1"]);
      return { rows: rows as T[], rowCount: rows.length };
    },
    async end() {},
  };
}

test("navigation is tenant scoped and filters scheduled links", async () => {
  const navigation = await getPublishedNavigation(database([{
    header_links: [{ href: "/shop", label: "Shop" }, { href: "/future", label: "Future", startsAt: "2999-01-01T00:00:00Z" }],
    header_links_mobile: [], footer_columns: [{ title: "Shop", links: [{ href: "/shop", label: "Shop" }] }],
    footer_bottom_links: [], social_links: [],
  }]), "org_1");
  assert.deepEqual(navigation?.headerLinks, [{ href: "/shop", label: "Shop" }]);
});

test("navigation handler returns an empty payload when no live row exists", async () => {
  const response = await handleNavigationRequest(new Request("https://api.example/store/navigation"), database([]), "org_1");
  assert.equal(response.status, 200);
  const payload = (await response.json()) as { navigation: { headerLinks: unknown[] } };
  assert.deepEqual(payload.navigation.headerLinks, []);
});
