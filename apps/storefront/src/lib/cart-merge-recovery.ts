export type CartMergeSnapshotItem = {
  id: string;
  variantId: string;
  quantity: number;
};

export type CartRestoreOperation =
  | { type: "update"; lineId: string; quantity: number }
  | { type: "delete"; lineId: string }
  | { type: "create"; variantId: string; quantity: number };

/** Builds the smallest set of operations that returns a cart to its snapshot. */
export function buildCartRestoreOperations(
  original: CartMergeSnapshotItem[],
  current: CartMergeSnapshotItem[],
): CartRestoreOperation[] {
  const originalById = new Map(original.map((item) => [item.id, item]));
  const currentIds = new Set(current.map((item) => item.id));
  const operations: CartRestoreOperation[] = [];

  for (const item of current) {
    const snapshot = originalById.get(item.id);
    if (!snapshot) {
      operations.push({ type: "delete", lineId: item.id });
    } else if (snapshot.quantity !== item.quantity) {
      operations.push({ type: "update", lineId: item.id, quantity: snapshot.quantity });
    }
  }
  for (const item of original) {
    if (!currentIds.has(item.id)) {
      operations.push({ type: "create", variantId: item.variantId, quantity: item.quantity });
    }
  }
  return operations;
}
