import assert from "node:assert/strict";
import test from "node:test";
import { buildRouteMetric, routeMetricsEnabled } from "./route-observability";

test("buildRouteMetric bounds and normalizes middleware telemetry", () => {
  const metric = buildRouteMetric({
    route: "x".repeat(300),
    method: "GET",
    family: "storefront",
    status: 200,
    durationMs: 1.236,
    requestId: "r".repeat(200),
    cache: "no-store",
  });
  assert.equal(metric.route.length, 240);
  assert.equal(metric.requestId.length, 128);
  assert.equal(metric.durationMs, 1.24);
  assert.equal(metric.event, "route_middleware");
});

test("route metrics stay disabled unless explicitly enabled", () => {
  const previous = process.env.UVS_ROUTE_METRICS;
  delete process.env.UVS_ROUTE_METRICS;
  assert.equal(routeMetricsEnabled(), false);
  process.env.UVS_ROUTE_METRICS = "1";
  assert.equal(routeMetricsEnabled(), true);
  if (previous === undefined) delete process.env.UVS_ROUTE_METRICS;
  else process.env.UVS_ROUTE_METRICS = previous;
});
