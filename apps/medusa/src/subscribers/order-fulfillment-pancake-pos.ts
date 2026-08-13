import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { registerPancakePosTracking } from "../lib/pancake-pos-client";

const LOGGER_TOKEN = "logger";
const ORDER_MODULE_TOKEN = "order";
const FULFILLMENT_MODULE_TOKEN = "fulfillment";

type FulfillmentCreatedData = {
  order_id: string;
  fulfillment_id: string;
  no_notification?: boolean;
};

export default async function orderFulfillmentPancakePosHandler({
  event: { data },
  container,
}: SubscriberArgs<FulfillmentCreatedData>) {
  const apiKey = process.env.PANCAKE_POS_API_KEY?.trim();
  const shopId = process.env.PANCAKE_POS_SHOP_ID?.trim();
  if (!apiKey || !shopId) {
    const logger = container.resolve(LOGGER_TOKEN) as {
      warn: (m: string) => void;
    };
    logger.warn(
      "[pancake-pos] PANCAKE_POS_API_KEY or PANCAKE_POS_SHOP_ID not configured — skipping fulfillment registration " +
        data.fulfillment_id,
    );
    return;
  }

  const logger = container.resolve(LOGGER_TOKEN) as {
    info: (m: string) => void;
    warn: (m: string) => void;
  };

  const orderModule = container.resolve(ORDER_MODULE_TOKEN);
  const fulfillmentModule = container.resolve(FULFILLMENT_MODULE_TOKEN);
  const fulfillment = await fulfillmentModule.retrieveFulfillment(data.fulfillment_id, {
    relations: ["labels"],
  });
  const order = (await orderModule.retrieveOrder(data.order_id, {
    relations: ["shipping_address", "items", "customer"],
  })) as {
    id?: string;
    display_id?: number;
    total?: number;
    shipping_address?: {
      first_name?: string | null;
      last_name?: string | null;
      phone?: string | null;
      address_1?: string | null;
      address_2?: string | null;
      city?: string | null;
      province?: string | null;
      postal_code?: string | null;
    } | null;
    items?: Array<{
      quantity?: number;
      variant?: { weight?: number | null } | null;
    }> | null;
    customer?: {
      first_name?: string | null;
      last_name?: string | null;
    } | null;
  };

  const label = fulfillment.labels?.[0];
  const trackingNumber = label?.tracking_number?.trim();
  if (!trackingNumber) {
    logger.warn(
      `[pancake-pos] fulfillment ${data.fulfillment_id} has no label tracking number; skipping Pancake POS registration.`,
    );
    return;
  }

  const shipping = order.shipping_address;
  if (!shipping) {
    logger.warn(
      `[pancake-pos] order ${data.order_id} has no shipping address; skipping Pancake POS registration.`,
    );
    return;
  }

  const receiverName = [
    shipping.first_name?.trim() || order.customer?.first_name?.trim() || "",
    shipping.last_name?.trim() || order.customer?.last_name?.trim() || "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const addressLine = [shipping.address_1, shipping.address_2]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ");
  const itemCount = (order.items ?? []).reduce(
    (sum, item) => sum + Math.max(1, Number(item.quantity ?? 1)),
    0,
  );
  const declaredValue = Number(order.total ?? 0) / 100;
  const totalWeightGrams = (order.items ?? []).reduce((sum, item) => {
    const itemWeight = Number(item.variant?.weight ?? 500);
    return sum + Math.max(0, itemWeight) * Math.max(1, Number(item.quantity ?? 1));
  }, 0);
  const weightKg = Math.max(0.5, totalWeightGrams / 1000);

  try {
    const result = await registerPancakePosTracking({
      orderId: data.order_id,
      trackingNumber,
      itemCount,
      goodsDescription: `Universal Music Store order ${order.display_id ?? data.order_id}`,
      declaredValue,
      weightKg,
      receiver: {
        name: receiverName || "Customer",
        mobile: shipping.phone?.trim() || "",
        phone: shipping.phone?.trim() || "",
        prov: shipping.province?.trim() || "",
        city: shipping.city?.trim() || "",
        area: shipping.postal_code?.trim() || "",
        address: addressLine || "",
      },
      remarks: `Fulfillment ${data.fulfillment_id}`,
    });

    await fulfillmentModule.updateFulfillment(data.fulfillment_id, {
      metadata: {
        ...((fulfillment.metadata as Record<string, unknown>) ?? {}),
        pancake_pos_registered_at: new Date().toISOString(),
        pancake_pos_order_id: result.orderId ?? data.order_id,
        pancake_pos_system_id: result.systemId ?? null,
        pancake_pos_tracking_number: result.trackingNumber ?? trackingNumber,
        pancake_pos_tracking_url: result.trackingUrl ?? result.labelUrl ?? null,
        pancake_pos_label_url: result.labelUrl ?? result.trackingUrl ?? null,
        pancake_pos_status: "registered",
      },
    });

    logger.info(
      `[pancake-pos] registered ${trackingNumber} for order ${data.order_id} fulfillment ${data.fulfillment_id}`,
    );
  } catch (err) {
    logger.warn(
      `[pancake-pos] tracking registration failed for ${trackingNumber}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

export const config: SubscriberConfig = {
  event: "order.fulfillment_created",
};
