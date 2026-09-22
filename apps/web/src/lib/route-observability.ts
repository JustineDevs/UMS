export type RouteMetric = {
  event: "route_middleware";
  route: string;
  method: string;
  family: "admin" | "storefront";
  status: number;
  durationMs: number;
  requestId: string;
  cache: string;
};

export function routeMetricsEnabled(): boolean {
  return process.env.UVS_ROUTE_METRICS === "1";
}

export function buildRouteMetric(input: Omit<RouteMetric, "event">): RouteMetric {
  return {
    event: "route_middleware",
    route: input.route.slice(0, 240),
    method: input.method.slice(0, 16),
    family: input.family,
    status: Number.isInteger(input.status) ? input.status : 500,
    durationMs: Number.isFinite(input.durationMs)
      ? Math.max(0, Math.round(input.durationMs * 100) / 100)
      : 0,
    requestId: input.requestId.slice(0, 128),
    cache: input.cache.slice(0, 120),
  };
}

export function emitRouteMetric(metric: RouteMetric): void {
  if (!routeMetricsEnabled()) return;
  console.info(JSON.stringify(metric));
}
