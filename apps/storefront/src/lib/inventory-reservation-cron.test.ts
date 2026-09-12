import assert from "node:assert/strict";
import test from "node:test";

import { collectActiveReservationTenants } from "./inventory-reservation-cron";

test("reservation expiry tenant scan covers every page and de-duplicates tenants", async () => {
  const pages = [
    [{ tenant_id: "org_a" }, { tenant_id: "org_b" }],
    [{ tenant_id: "org_b" }, { tenant_id: "org_c" }],
    [{ tenant_id: " " }],
  ];
  const ranges: Array<[number, number]> = [];
  const tenants = await collectActiveReservationTenants(async (from, to) => {
    ranges.push([from, to]);
    return pages.shift() ?? [];
  }, 2);

  assert.deepEqual(tenants, ["org_a", "org_b", "org_c"]);
  assert.deepEqual(ranges, [[0, 1], [2, 3], [4, 5]]);
});

test("reservation expiry tenant scan rejects invalid page sizes", async () => {
  await assert.rejects(
    () => collectActiveReservationTenants(async () => [], 0),
    /pageSize must be a positive integer/,
  );
});
