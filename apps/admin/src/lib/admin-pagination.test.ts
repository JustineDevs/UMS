import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAdminPagination } from "./admin-pagination";

test("admin pagination exposes canonical empty and boundary metadata", () => {
  assert.deepEqual(buildAdminPagination(1, 25, 0), { page: 1, pageSize: 25, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
  assert.deepEqual(buildAdminPagination(2, 25, 51), { page: 2, pageSize: 25, total: 51, totalPages: 3, hasNextPage: true, hasPreviousPage: true });
});
