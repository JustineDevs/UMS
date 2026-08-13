import { createHash } from "node:crypto";

export function hashChannelPayload(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function validateChannelScope(input: { requested: string; allowed: readonly string[] }): boolean {
  const requested = input.requested.trim();
  return Boolean(requested) && input.allowed.includes(requested);
}
