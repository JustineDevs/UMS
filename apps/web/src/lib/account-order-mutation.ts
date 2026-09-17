import { createHash } from "node:crypto";

const CANCELLABLE_STATUSES = new Set(["pending", "pending_payment", "requires_action"]);

export function isCancellableOrderStatus(status: unknown): boolean {
  return typeof status === "string" && CANCELLABLE_STATUSES.has(status);
}

export function buildOrderCancellationIdempotencyKey(email: string, orderId: string): string {
  return createHash("sha256")
    .update(`order-cancel:${email.trim().toLowerCase()}:${orderId.trim()}`)
    .digest("hex");
}
