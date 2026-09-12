export type CommerceJobName =
  | "payment-reconciliation"
  | "webhook-finalization"
  | "inventory-reservation-expiry"
  | "notification-delivery";

export type CommerceJob<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> = {
  id: string;
  name: CommerceJobName;
  payload: TPayload;
  attempt: number;
  createdAt: string;
};

export type WorkerQueueMessage = {
  body: unknown;
  id: string;
  attempts: number;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
};

export type DeadLetterSink = (message: WorkerQueueMessage, error: unknown) => Promise<void>;

export type WorkerQueue = {
  send(body: CommerceJob, options?: { delaySeconds?: number }): Promise<unknown>;
};

const MAX_PAYLOAD_BYTES = 128 * 1024;
const MAX_ATTEMPTS = 8;
const JOB_NAMES = new Set<CommerceJobName>([
  "payment-reconciliation",
  "webhook-finalization",
  "inventory-reservation-expiry",
  "notification-delivery",
]);

function serializedSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function createCommerceJob<TPayload extends Record<string, unknown>>(
  name: CommerceJobName,
  payload: TPayload,
  id = crypto.randomUUID(),
): CommerceJob<TPayload> {
  if (serializedSize(payload) > MAX_PAYLOAD_BYTES)
    throw new Error("commerce_job_payload_too_large");
  return { id, name, payload, attempt: 0, createdAt: new Date().toISOString() };
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function correlationIdFromJob(job: CommerceJob): string {
  if (job.name !== "webhook-finalization" && job.name !== "payment-reconciliation")
    throw new Error(`unsupported_commerce_job:${job.name}`);
  const value = job.payload.correlationId;
  if (typeof value !== "string" || !UUID_V4.test(value))
    throw new Error("invalid_payment_reconciliation_correlation_id");
  return value;
}

export async function enqueueCommerceJob<
  TPayload extends Record<string, unknown>,
>(queue: WorkerQueue, job: CommerceJob<TPayload>): Promise<void> {
  if (job.attempt < 0 || job.attempt >= MAX_ATTEMPTS)
    throw new Error("commerce_job_attempt_limit");
  await queue.send(job);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate untrusted queue payloads before handing them to a job handler. */
export function isCommerceJob(value: unknown): value is CommerceJob {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== "string" ||
    value.id.length < 1 ||
    value.id.length > 128 ||
    typeof value.name !== "string" ||
    !JOB_NAMES.has(value.name as CommerceJobName) ||
    !isRecord(value.payload) ||
    !Number.isInteger(value.attempt) ||
    (value.attempt as number) < 0 ||
    (value.attempt as number) >= MAX_ATTEMPTS ||
    typeof value.createdAt !== "string"
  )
    return false;
  return Number.isFinite(Date.parse(value.createdAt));
}

export function handleCommerceJobMessage(
  message: WorkerQueueMessage,
  handler: (job: CommerceJob) => Promise<void>,
  deadLetter?: DeadLetterSink,
): Promise<void> {
  if (!isCommerceJob(message.body)) {
    message.ack();
    return Promise.resolve();
  }
  return handler(message.body).then(
    () => message.ack(),
    (error) => {
      if (message.attempts >= MAX_ATTEMPTS) {
        return (deadLetter ? deadLetter(message, error) : Promise.resolve()).then(() => message.ack());
      }
      else
        message.retry({
          delaySeconds: Math.min(300, 2 ** Math.max(0, message.attempts)),
        });
    },
  );
}

/** Cloudflare Queue consumer boundary; one bad message must not abort the batch. */
export async function handleCommerceJobBatch(
  messages: readonly WorkerQueueMessage[],
  handler: (job: CommerceJob) => Promise<void>,
  deadLetter?: DeadLetterSink,
): Promise<void> {
  await Promise.all(messages.map((message) => handleCommerceJobMessage(message, handler, deadLetter)));
}
