import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { registerJntTracking } from "../lib/jnt-client";

type FulfillmentCreatedData = {
  order_id: string;
  fulfillment_id: string;
  no_notification?: boolean;
};

export default async function orderFulfillmentJntHandler({
  event: { data },
  container,
}: SubscriberArgs<FulfillmentCreatedData>) {
  const apiKey = process.env.JNT_API_KEY?.trim();
  if (!apiKey) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as {
      warn: (m: string) => void;
    };
    logger.warn(
      "[jnt] JNT_API_KEY not configured — skipping tracking registration for fulfillment " +
        data.fulfillment_id,
    );
    return;
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as {
    info: (m: string) => void;
    warn: (m: string) => void;
  };

  const fulfillmentModule = container.resolve(Modules.FULFILLMENT);
  const fulfillment = await fulfillmentModule.retrieveFulfillment(data.fulfillment_id, {
    relations: ["labels"],
  });

  const label = fulfillment.labels?.[0];
  const trackingNumber = label?.tracking_number?.trim();
  if (!trackingNumber) {
    logger.warn(
      `[jnt] fulfillment ${data.fulfillment_id} has no label tracking number; skipping J&T registration.`,
    );
    return;
  }

  try {
    await registerJntTracking({
      trackingNumber,
      orderId: data.order_id,
    });

    await fulfillmentModule.updateFulfillment(data.fulfillment_id, {
      metadata: {
        ...((fulfillment.metadata as Record<string, unknown>) ?? {}),
        jnt_registered_at: new Date().toISOString(),
      },
    });

    logger.info(
      `[jnt] registered ${trackingNumber} for order ${data.order_id} fulfillment ${data.fulfillment_id}`,
    );
  } catch (err) {
    logger.warn(
      `[jnt] tracking registration failed for ${trackingNumber}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

export const config: SubscriberConfig = {
  event: "order.fulfillment_created",
};
