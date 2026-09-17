import { randomUUID } from "node:crypto";

const HEADER_CANDIDATES = ["x-request-id", "x-correlation-id"] as const;

export function getCorrelationId(req: Request): string {
  for (const name of HEADER_CANDIDATES) {
    const v = req.headers.get(name)?.trim();
    if (v) return v.slice(0, 128);
  }
  return randomUUID();
}
