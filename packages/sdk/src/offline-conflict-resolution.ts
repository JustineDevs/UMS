export type ConflictStrategy = "client_wins" | "server_wins" | "merge" | "manual";

export type QueueEntry = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
  deviceId: string;
  idempotencyKey: string;
};

export type ConflictResult = {
  entryId: string;
  strategy: ConflictStrategy;
  resolved: boolean;
  mergedPayload?: Record<string, unknown>;
  error?: string;
};

export type ConflictRule = {
  entryType: string;
  strategy: ConflictStrategy;
  mergeFields?: string[];
};

const CONFLICT_RULES: ConflictRule[] = [
  { entryType: "sale", strategy: "server_wins" },
  { entryType: "refund", strategy: "server_wins" },
  { entryType: "inventory_adjustment", strategy: "merge", mergeFields: ["quantity"] },
  { entryType: "cash_drawer_open", strategy: "client_wins" },
  { entryType: "cash_drawer_close", strategy: "client_wins" },
  { entryType: "receipt_print", strategy: "client_wins" },
];

export function getConflictRule(entryType: string): ConflictRule {
  return CONFLICT_RULES.find((r) => r.entryType === entryType) ?? {
    entryType,
    strategy: "server_wins",
  };
}

export function resolveConflict(
  entry: QueueEntry,
  serverState: Record<string, unknown> | null,
): ConflictResult {
  const rule = getConflictRule(entry.type);

  if (!serverState) {
    return { entryId: entry.id, strategy: rule.strategy, resolved: true };
  }

  switch (rule.strategy) {
    case "client_wins":
      return { entryId: entry.id, strategy: "client_wins", resolved: true };

    case "server_wins":
      return { entryId: entry.id, strategy: "server_wins", resolved: true };

    case "merge": {
      const merged = { ...serverState };
      for (const field of rule.mergeFields ?? []) {
        const clientVal = entry.payload[field];
        const serverVal = serverState[field];
        if (typeof clientVal === "number" && typeof serverVal === "number") {
          merged[field] = serverVal + clientVal;
        } else if (clientVal !== undefined) {
          merged[field] = clientVal;
        }
      }
      return {
        entryId: entry.id,
        strategy: "merge",
        resolved: true,
        mergedPayload: merged,
      };
    }

    case "manual":
      return {
        entryId: entry.id,
        strategy: "manual",
        resolved: false,
        error: "Requires manual resolution by staff",
      };

    default:
      return { entryId: entry.id, strategy: "server_wins", resolved: true };
  }
}

export function detectDuplicateEntry(
  existingKeys: Set<string>,
  entry: QueueEntry,
): boolean {
  return existingKeys.has(entry.idempotencyKey);
}

export function processOfflineQueue(
  queue: QueueEntry[],
  serverStates: Map<string, Record<string, unknown>>,
  processedKeys: Set<string>,
): { processed: ConflictResult[]; skipped: string[] } {
  const results: ConflictResult[] = [];
  const skipped: string[] = [];

  for (const entry of queue) {
    if (detectDuplicateEntry(processedKeys, entry)) {
      skipped.push(entry.id);
      continue;
    }

    const serverState = serverStates.get(entry.idempotencyKey) ?? null;
    const result = resolveConflict(entry, serverState);
    results.push(result);
    processedKeys.add(entry.idempotencyKey);
  }

  return { processed: results, skipped };
}
