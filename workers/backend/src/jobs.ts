import { withWorkerDatabase, type WorkerDatabaseClient, type WorkerDatabaseEnv } from "./database.ts";
import type { CommerceJob } from "./queue.ts";

type ReservationExpiryPayload = {
  tenantId: string;
  limit?: number;
};

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reservationExpiryPayload(job: CommerceJob): ReservationExpiryPayload {
  if (job.name !== "inventory-reservation-expiry") {
    throw new Error(`unsupported_commerce_job:${job.name}`);
  }
  const payload = job.payload;
  const tenantId = typeof payload.tenantId === "string" ? payload.tenantId.trim() : "";
  const limit = payload.limit === undefined ? 500 : payload.limit;
  if (!tenantId || tenantId.length > 128) throw new Error("invalid_reservation_expiry_tenant");
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 5000) {
    throw new Error("invalid_reservation_expiry_limit");
  }
  return { tenantId, limit };
}

export async function expireDueReservations(
  database: WorkerDatabaseClient,
  job: CommerceJob,
): Promise<number> {
  const { tenantId, limit } = reservationExpiryPayload(job);
  const result = await database.query<{ count: number }>(
    "SELECT public.inventory_reservation_expire_due($1,$2)::integer AS count",
    [tenantId, limit],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function handleInventoryReservationExpiryJob(
  env: WorkerDatabaseEnv,
  job: CommerceJob,
): Promise<number> {
  return withWorkerDatabase(env, (database) => expireDueReservations(database, job), "app");
}

export function isInventoryReservationExpiryJob(job: CommerceJob): boolean {
  return job.name === "inventory-reservation-expiry";
}

type NotificationPayload = {
  attemptId: string;
  recipient: string;
  subject: string;
  html: string;
};

type NotificationEnv = WorkerDatabaseEnv & {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_FROM?: string;
};

function notificationPayload(job: CommerceJob): NotificationPayload {
  if (job.name !== "notification-delivery") {
    throw new Error(`unsupported_commerce_job:${job.name}`);
  }
  const payload = job.payload;
  const attemptId = typeof payload.attemptId === "string" ? payload.attemptId.trim() : "";
  const recipient = typeof payload.recipient === "string" ? payload.recipient.trim().toLowerCase() : "";
  const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const html = typeof payload.html === "string" ? payload.html : "";
  if (!UUID_V4.test(attemptId)) throw new Error("invalid_notification_attempt_id");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || recipient.length > 320) {
    throw new Error("invalid_notification_recipient");
  }
  if (subject.length < 1 || subject.length > 200) throw new Error("invalid_notification_subject");
  if (html.length < 1 || html.length > 100_000 || /<script\b/i.test(html)) {
    throw new Error("invalid_notification_body");
  }
  return { attemptId, recipient, subject, html };
}

export async function deliverNotification(
  database: WorkerDatabaseClient,
  env: NotificationEnv,
  job: CommerceJob,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  const payload = notificationPayload(job);
  if (!env.RESEND_API_KEY?.trim()) throw new Error("RESEND_API_KEY is not configured");
  const claimed = await database.query<{ id: string }>(
    `UPDATE public.public_delivery_attempts
     SET status = 'retry', attempts = attempts + 1, last_attempt_at = now()
     WHERE id = $1 AND recipient = $2 AND status IN ('queued', 'retry')
     RETURNING id`,
    [payload.attemptId, payload.recipient],
  );
  if (claimed.rowCount !== 1) {
    const existing = await database.query<{ status: string }>(
      "SELECT status FROM public.public_delivery_attempts WHERE id = $1",
      [payload.attemptId],
    );
    if (existing.rows[0]?.status === "sent") return null;
    throw new Error("notification_attempt_not_claimable");
  }
  let response: Response;
  try {
    response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": payload.attemptId,
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL?.trim() || env.RESEND_FROM?.trim() || "noreply@universal-music-store.com",
        to: [payload.recipient],
        subject: payload.subject,
        html: payload.html,
      }),
    });
  } catch (error) {
    await database.query(
      "UPDATE public.public_delivery_attempts SET status = 'retry', last_error = $2 WHERE id = $1",
      [payload.attemptId, error instanceof Error ? error.message.slice(0, 500) : "provider_request_failed"],
    );
    throw error;
  }
  const responseBody = (await response.json().catch(() => ({}))) as { id?: unknown; message?: unknown };
  if (!response.ok || typeof responseBody.id !== "string") {
    await database.query(
      "UPDATE public.public_delivery_attempts SET status = 'retry', last_error = $2 WHERE id = $1",
      [payload.attemptId, typeof responseBody.message === "string" ? responseBody.message.slice(0, 500) : `resend_http_${response.status}`],
    );
    throw new Error("notification_provider_rejected");
  }
  await database.query(
    "UPDATE public.public_delivery_attempts SET status = 'sent', provider_message_id = $2, sent_at = now(), last_error = NULL WHERE id = $1",
    [payload.attemptId, responseBody.id],
  );
  return responseBody.id;
}

export async function handleNotificationDeliveryJob(
  env: NotificationEnv,
  job: CommerceJob,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  return withWorkerDatabase(env, (database) => deliverNotification(database, env, job, fetcher), "app");
}

export function isNotificationDeliveryJob(job: CommerceJob): boolean {
  return job.name === "notification-delivery";
}
