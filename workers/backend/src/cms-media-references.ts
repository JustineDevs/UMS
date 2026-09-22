import type { WorkerDatabaseClient } from "./database.ts";

/** Locks tenant media referenced by a complete CMS payload until the write commits. */
export async function lockCmsMediaReferences(
  transaction: WorkerDatabaseClient,
  organizationId: string,
  payload: unknown,
): Promise<boolean> {
  const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
  const result = await transaction.query<{ deleted_at: string | null }>(
    `SELECT deleted_at
       FROM public.cms_media
      WHERE organization_id = $1
        AND public_url <> ''
        AND strpos($2, public_url) > 0
      ORDER BY id
      FOR SHARE`,
    [organizationId, serialized],
  );
  return !result.rows.some((row) => row.deleted_at != null);
}
