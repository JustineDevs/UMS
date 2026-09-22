import test from "node:test";
import assert from "node:assert/strict";
import { collectDevRuntimeDiagnostics } from "./dev-runtime-diagnostics";

test("development diagnostics are bounded and include process, event-loop, and SSE data", async () => {
  const diagnostics = await collectDevRuntimeDiagnostics(10);
  assert.ok(diagnostics.process.pid > 0);
  assert.ok(diagnostics.process.rssBytes > 0);
  assert.equal(diagnostics.eventLoop.sampleMs, 10);
  assert.ok(diagnostics.activeSseClients >= 0);
});
