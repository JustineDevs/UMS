/**
 * True when the relation is missing: Postgres undefined_table, or PostgREST
 * "Could not find the table ... in the schema cache" (migrations not applied / table not exposed).
 */
export function isMissingTableOrSchemaError(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false;
  if (error.code === "42P01") return true;
  if (error.code === "PGRST205") return true;
  if (error.code === "PGRST202") return true;
  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("could not find the table") && msg.includes("schema cache")) {
    return true;
  }
  if (msg.includes("relation") && msg.includes("does not exist")) {
    return true;
  }
  return false;
}
