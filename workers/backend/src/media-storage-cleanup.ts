import type { WorkerDatabaseClient } from "./database.ts";

export type MediaStorageCleanupEnv = {
  SUPABASE_URL?: string;
  SUPABASE_STORAGE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type CleanupCandidate = {
  id: string;
  storage_path: string;
  tags: string[];
  attempts: number;
};

function storageObjectUrl(baseUrl: string, bucket: string, storagePath: string): string {
  const path = storagePath.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl.replace(/\/$/, "")}/storage/v1/object/${bucket}/${path}`;
}

export async function runMediaStorageCleanupSweep(
  appDatabase: WorkerDatabaseClient,
  env: MediaStorageCleanupEnv,
  fetcher: typeof fetch = fetch,
): Promise<{ scanned: number; deleted: number; retried: number }> {
  const storageUrl = env.SUPABASE_STORAGE_URL?.trim() || env.SUPABASE_URL?.trim();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!storageUrl || !serviceKey) throw new Error("media_storage_not_configured");

  const candidates = await appDatabase.query<CleanupCandidate>(
    `SELECT id::text, storage_path, tags, storage_cleanup_attempts AS attempts
     FROM public.cms_media
     WHERE deleted_at IS NOT NULL
       AND storage_cleanup_status IN ('pending', 'retry')
       AND (storage_cleanup_next_attempt_at IS NULL OR storage_cleanup_next_attempt_at <= now())
     ORDER BY deleted_at ASC, id ASC
     LIMIT 25`,
  );
  let deleted = 0;
  let retried = 0;

  for (const candidate of candidates.rows) {
    const claim = await appDatabase.query<CleanupCandidate>(
      `UPDATE public.cms_media
       SET storage_cleanup_status = 'processing',
           storage_cleanup_attempts = storage_cleanup_attempts + 1,
           storage_cleanup_last_attempt_at = now()
       WHERE id = $1 AND deleted_at IS NOT NULL
         AND ((storage_cleanup_status IN ('pending', 'retry')
               AND (storage_cleanup_next_attempt_at IS NULL OR storage_cleanup_next_attempt_at <= now()))
           OR (storage_cleanup_status = 'processing'
               AND storage_cleanup_last_attempt_at < now() - interval '15 minutes'))
       RETURNING id::text, storage_path, tags, storage_cleanup_attempts AS attempts`,
      [candidate.id],
    );
    const claimed = claim.rows[0];
    if (!claimed) continue;

    if (claimed.storage_path.startsWith("external/")) {
      await appDatabase.query(
        "UPDATE public.cms_media SET storage_cleanup_status = 'external', storage_cleanup_next_attempt_at = NULL WHERE id = $1 AND storage_cleanup_status = 'processing'",
        [claimed.id],
      );
      deleted += 1;
      continue;
    }

    const bucket = claimed.tags.includes("catalog-product") ? "catalog" : "cms";
    try {
      const response = await fetcher(storageObjectUrl(storageUrl, bucket, claimed.storage_path), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok && response.status !== 404) throw new Error("storage_delete_rejected");
      await appDatabase.query(
        `UPDATE public.cms_media
         SET storage_cleanup_status = 'complete', storage_cleanup_next_attempt_at = NULL,
             storage_cleanup_last_error = NULL, storage_cleanup_completed_at = now()
         WHERE id = $1 AND storage_cleanup_status = 'processing'`,
        [claimed.id],
      );
      deleted += 1;
    } catch {
      await appDatabase.query(
        `UPDATE public.cms_media
         SET storage_cleanup_status = 'retry',
             storage_cleanup_next_attempt_at = now() + make_interval(mins => LEAST(1440, 5 * power(2, LEAST(8, GREATEST(storage_cleanup_attempts - 1, 0)))::integer)),
             storage_cleanup_last_error = 'storage_delete_failed'
         WHERE id = $1 AND storage_cleanup_status = 'processing'`,
        [claimed.id],
      );
      retried += 1;
    }
  }

  return { scanned: candidates.rows.length, deleted, retried };
}
