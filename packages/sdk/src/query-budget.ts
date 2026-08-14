export type QueryBudget = {
  maxDurationMs: number;
  maxRows: number;
  warnDurationMs: number;
};

export const QUERY_BUDGETS: Record<string, QueryBudget> = {
  "catalog-list": { maxDurationMs: 500, maxRows: 100, warnDurationMs: 200 },
  "catalog-detail": { maxDurationMs: 300, maxRows: 1, warnDurationMs: 100 },
  "order-list": { maxDurationMs: 1000, maxRows: 50, warnDurationMs: 500 },
  "order-detail": { maxDurationMs: 500, maxRows: 1, warnDurationMs: 200 },
  "analytics-daily": { maxDurationMs: 3000, maxRows: 365, warnDurationMs: 1500 },
  "analytics-aggregate": { maxDurationMs: 5000, maxRows: 1, warnDurationMs: 2500 },
  "inventory-scan": { maxDurationMs: 2000, maxRows: 500, warnDurationMs: 1000 },
  "admin-search": { maxDurationMs: 1000, maxRows: 50, warnDurationMs: 500 },
};

export type QueryResult = {
  durationMs: number;
  rowCount: number;
};

export function checkQueryBudget(
  queryName: string,
  result: QueryResult,
): { withinBudget: boolean; warnings: string[] } {
  const budget = QUERY_BUDGETS[queryName];
  if (!budget) return { withinBudget: true, warnings: [] };

  const warnings: string[] = [];

  if (result.durationMs > budget.maxDurationMs) {
    warnings.push(
      `Query "${queryName}" exceeded max duration: ${result.durationMs}ms > ${budget.maxDurationMs}ms`,
    );
    return { withinBudget: false, warnings };
  }

  if (result.rowCount > budget.maxRows) {
    warnings.push(
      `Query "${queryName}" exceeded max rows: ${result.rowCount} > ${budget.maxRows}`,
    );
    return { withinBudget: false, warnings };
  }

  if (result.durationMs > budget.warnDurationMs) {
    warnings.push(
      `Query "${queryName}" approaching limit: ${result.durationMs}ms > ${budget.warnDurationMs}ms warn threshold`,
    );
  }

  return { withinBudget: true, warnings };
}

export const CONNECTION_POOL_CONFIG = {
  max: Number(process.env.DB_POOL_MAX) || 20,
  min: Number(process.env.DB_POOL_MIN) || 2,
  idleTimeoutMs: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS) || 30_000,
  connectionTimeoutMs: Number(process.env.DB_POOL_CONNECTION_TIMEOUT_MS) || 5_000,
  statementTimeoutMs: Number(process.env.DB_STATEMENT_TIMEOUT_MS) || 10_000,
};
