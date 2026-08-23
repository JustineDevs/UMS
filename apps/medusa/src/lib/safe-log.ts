import { createHash } from "node:crypto";

/** Keep operational correlation possible without exposing customer identifiers. */
export function safeLogIdentifier(value: string | number | null | undefined): string {
  if (value == null || String(value).trim() === "") return "unknown";
  return `id_${createHash("sha256").update(String(value), "utf8").digest("hex").slice(0, 16)}`;
}
