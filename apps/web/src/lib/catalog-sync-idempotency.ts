import { createHash } from "node:crypto";

export function catalogSyncIdempotencyKey(input: {
  productId: string;
  title: string;
  description?: string | null;
  handle?: string | null;
  pricePhp: number;
  operation: "create" | "update";
}): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 32);
  return `catalog:${input.productId}:${input.operation}:${digest}`;
}
