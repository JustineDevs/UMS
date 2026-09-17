const RECONCILIATION_PROVIDERS = new Set(["all", "stripe", "paypal", "xendit", "cod"]);

export type ReconciliationQuery = {
  days: number;
  provider: "all" | "stripe" | "paypal" | "xendit" | "cod";
};

export function parseReconciliationQuery(searchParams: URLSearchParams):
  | { ok: true; value: ReconciliationQuery }
  | { ok: false; error: "Invalid reconciliation provider" } {
  const provider = searchParams.get("provider") || "all";
  if (!RECONCILIATION_PROVIDERS.has(provider)) {
    return { ok: false, error: "Invalid reconciliation provider" };
  }

  const rawDays = searchParams.get("days");
  const requestedDays = rawDays == null || rawDays.trim() === "" ? Number.NaN : Number(rawDays);
  const days = Number.isFinite(requestedDays)
    ? Math.min(Math.max(Math.floor(requestedDays), 1), 90)
    : 7;

  return {
    ok: true,
    value: {
      days,
      provider: provider as ReconciliationQuery["provider"],
    },
  };
}
