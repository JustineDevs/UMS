import {
  BackendEnv,
  handleBackendRequest,
} from "./router.ts";
import {
  correlationIdFromJob as readCorrelationIdFromJob,
  handleCommerceJobBatch,
  type CommerceJob,
} from "./queue.ts";
import { finalizeNativeOrderAcrossDatabases } from "./order-finalization.ts";
import { withWorkerDatabase } from "./database.ts";
import {
  handleInventoryReservationExpiryJob,
  handleNotificationDeliveryJob,
  isInventoryReservationExpiryJob,
  isNotificationDeliveryJob,
} from "./jobs.ts";

export { handleBackendRequest } from "./router.ts";
export * from "./idempotency.ts";
export * from "./catalog.ts";
export * from "./cart.ts";
export * from "./inventory.ts";
export * from "./checkout.ts";
export * from "./providers.ts";
export * from "./queue.ts";
export * from "./webhooks.ts";
export * from "./auth.ts";
export * from "./orders.ts";
export * from "./profile.ts";
export * from "./payment-attempts.ts";
export * from "./cms-admin.ts";
export * from "./navigation-admin.ts";
export * from "./announcement-admin.ts";
export * from "./blog-admin.ts";
export * from "./category-admin.ts";
export * from "./media-admin.ts";
export * from "./order-finalization.ts";
export * from "./order-mutations.ts";
export * from "./admin-refund.ts";
export * from "./compliance.ts";
export * from "./wishlist.ts";
export * from "./jobs.ts";

interface WorkerEnv extends BackendEnv {
  COMMERCE_QUEUE?: Queue<CommerceJob>;
  COMMERCE_DEAD_LETTER_QUEUE?: Queue<unknown>;
}

async function handleNativeCommerceJob(
  job: CommerceJob,
  env: WorkerEnv,
): Promise<void> {
  if (isInventoryReservationExpiryJob(job)) {
    await handleInventoryReservationExpiryJob(env, job);
    return;
  }
  if (isNotificationDeliveryJob(job)) {
    await handleNotificationDeliveryJob(env, job);
    return;
  }
  const correlationId = readCorrelationIdFromJob(job);
  await withWorkerDatabase(env, (appDatabase) =>
    withWorkerDatabase(env, (commerceDatabase) =>
      finalizeNativeOrderAcrossDatabases(appDatabase, commerceDatabase, correlationId).then(() => undefined),
      "medusa",
    ),
    "app",
  );
}

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return handleBackendRequest(request, env);
  },
  async queue(
    batch: MessageBatch<unknown>,
    env: WorkerEnv,
  ): Promise<void> {
    await handleCommerceJobBatch(
      batch.messages,
      (job) => handleNativeCommerceJob(job, env),
      env.COMMERCE_DEAD_LETTER_QUEUE
        ? async (message, error) => {
            await env.COMMERCE_DEAD_LETTER_QUEUE!.send({
              originalMessageId: message.id,
              attempts: message.attempts,
              body: message.body,
              error: error instanceof Error ? error.message : "commerce_job_failed",
              deadLetteredAt: new Date().toISOString(),
            });
          }
        : undefined,
    );
  },
};
