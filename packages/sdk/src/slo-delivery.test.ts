import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { deliverSloAlert, evaluateSloAlert } from "./slo";

test("SLO alert delivery posts an alert payload to the configured receiver", async () => {
  let body = "";
  const server = createServer((request, response) => {
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => response.writeHead(204).end());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  await deliverSloAlert(
    `http://127.0.0.1:${address.port}`,
    evaluateSloAlert({ name: "test", target: 100, window: "1h", metric: "test_p95", unit: "ms" }, 250),
  );
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const payload = JSON.parse(body) as { type?: string; severity?: string; currentValue?: number };
  assert.equal(payload.type, "slo_alert");
  assert.equal(payload.severity, "critical");
  assert.equal(payload.currentValue, 250);
});
