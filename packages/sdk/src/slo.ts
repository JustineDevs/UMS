export type SloDefinition = {
  name: string;
  target: number;
  window: "1h" | "24h" | "7d" | "30d";
  metric: string;
  unit: "percent" | "ms" | "count";
};

export const SLO_DEFINITIONS: SloDefinition[] = [
  { name: "Checkout Start Latency p95", target: 2000, window: "24h", metric: "checkout_start_p95", unit: "ms" },
  { name: "Checkout Success Rate", target: 99.5, window: "24h", metric: "checkout_success_rate", unit: "percent" },
  { name: "Webhook Processing Latency p95", target: 5000, window: "24h", metric: "webhook_processing_p95", unit: "ms" },
  { name: "Medusa API Availability", target: 99.9, window: "30d", metric: "medusa_availability", unit: "percent" },
  { name: "Storefront TTFB p95", target: 800, window: "24h", metric: "storefront_ttfb_p95", unit: "ms" },
  { name: "Cart API Error Rate", target: 0.1, window: "24h", metric: "cart_error_rate", unit: "percent" },
  { name: "Payment Capture Success Rate", target: 99.0, window: "7d", metric: "payment_capture_rate", unit: "percent" },
  { name: "Search Response p95", target: 500, window: "24h", metric: "search_p95", unit: "ms" },
];

export type SloStatus = {
  definition: SloDefinition;
  currentValue: number;
  withinBudget: boolean;
  budgetRemaining: number;
  burnRate: number;
};

export type SloAlert = SloStatus & {
  severity: "critical" | "warning" | "ok";
};

export async function deliverSloAlert(
  endpoint: string,
  alert: SloAlert,
  options: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<void> {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("SLO alert endpoint must use HTTPS");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 5000);
  try {
    const response = await (options.fetch ?? fetch)(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "slo_alert", ...alert, emittedAt: new Date().toISOString() }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`SLO alert delivery failed with HTTP ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

export function evaluateSlo(definition: SloDefinition, currentValue: number): SloStatus {
  const isLatency = definition.unit === "ms";
  const isErrorRate = definition.metric.includes("error_rate");

  let withinBudget: boolean;
  let budgetRemaining: number;

  if (isLatency) {
    withinBudget = currentValue <= definition.target;
    budgetRemaining = Math.max(0, definition.target - currentValue);
  } else if (isErrorRate) {
    withinBudget = currentValue <= definition.target;
    budgetRemaining = Math.max(0, definition.target - currentValue);
  } else {
    withinBudget = currentValue >= definition.target;
    budgetRemaining = Math.max(0, currentValue - definition.target);
  }

  const burnRate = withinBudget
    ? budgetRemaining / (definition.target || 1)
    : -(Math.abs(currentValue - definition.target) / (definition.target || 1));

  return {
    definition,
    currentValue,
    withinBudget,
    budgetRemaining,
    burnRate,
  };
}

export function evaluateSloAlert(
  definition: SloDefinition,
  currentValue: number,
): SloAlert {
  const status = evaluateSlo(definition, currentValue);
  if (status.withinBudget) return { ...status, severity: "ok" };
  return {
    ...status,
    severity: Math.abs(status.burnRate) >= 0.25 ? "critical" : "warning",
  };
}

export function formatSloValue(value: number, unit: SloDefinition["unit"]): string {
  switch (unit) {
    case "ms": return `${value.toFixed(0)}ms`;
    case "percent": return `${value.toFixed(2)}%`;
    case "count": return value.toFixed(0);
  }
}
