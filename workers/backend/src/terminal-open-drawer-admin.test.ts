import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleAdminTerminalOpenDrawerRequest } from "./terminal-open-drawer-admin.ts";

test("terminal drawer fails closed without staff bearer authentication", async () => {
  const database: WorkerDatabaseClient = { async query() { throw new Error("database must not be queried"); }, async end() {} };
  const response = await handleAdminTerminalOpenDrawerRequest(new Request("https://api.example/api/admin/terminal-open-drawer", { method: "POST", body: JSON.stringify({ reason: "cash audit" }) }), database, { CMS_ADMIN_JWT_SECRET: "secret", TERMINAL_AGENT_URL: "https://terminal.example" });
  assert.equal(response.status, 401);
});
