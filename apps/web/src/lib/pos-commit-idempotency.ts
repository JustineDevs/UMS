/**
 * In-process replay cache for Idempotency-Key on POS commit-sale.
 * Survives duplicate client retries within the TTL. For multi-instance deploys, extend with shared storage.
 */

const completed = new Map<string, { orderNumber: string; at: number }>();
const TTL_MS = 48 * 60 * 60 * 1000;
const MAX_ENTRIES = 10_000;

function prune(): void {
  const now = Date.now();
  if (completed.size < MAX_ENTRIES) {
    for (const [k, v] of completed) {
      if (now - v.at > TTL_MS) completed.delete(k);
    }
    return;
  }
  const drop = Math.ceil(completed.size * 0.2);
  const keys = [...completed.keys()].slice(0, drop);
  for (const k of keys) completed.delete(k);
}

export function getCompletedPosCommitOrderNumber(
  idempotencyKey: string,
): string | null {
  const key = idempotencyKey.trim();
  if (!key) return null;
  prune();
  const row = completed.get(key);
  if (!row) return null;
  if (Date.now() - row.at > TTL_MS) {
    completed.delete(key);
    return null;
  }
  return row.orderNumber;
}

export function rememberCompletedPosCommit(
  idempotencyKey: string,
  orderNumber: string,
): void {
  const key = idempotencyKey.trim();
  if (!key || !orderNumber.trim()) return;
  prune();
  completed.set(key, { orderNumber: orderNumber.trim(), at: Date.now() });
}
