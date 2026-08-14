/**
 * Returns true when the server must not boot (production without INTERNAL_API_KEY).
 * Used by index.ts to fail-fast before listen.
 */
export function shouldFailBootForMissingInternalKey(): boolean {
  return (
    process.env.NODE_ENV === "production" && !process.env.INTERNAL_API_KEY
  );
}
