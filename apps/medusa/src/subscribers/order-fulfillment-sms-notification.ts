import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { Modules } from "@medusajs/framework/utils";
import { inngest } from "../lib/inngest/client";

/**
 * Fires an Inngest event `universal-music-store/fulfillment.created` when a fulfillment is created.
 * Inngest handles retry logic, backoff, and delivery guarantees.
 */
export default async function orderFulfillmentSmsNotification({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const apiKey = process.env.SEMAPHORE_API_KEY?.trim();
  if (!apiKey) return;

  const { DEFAULT_PUBLIC_SITE_ORIGIN } = await import(
    "@universal-music-store/sdk"
  );
  const storefrontUrl =
    process.env.STOREFRONT_PUBLIC_URL?.trim() ??
    DEFAULT_PUBLIC_SITE_ORIGIN;

  try {
    const fulfillmentModule = container.resolve(Modules.FULFILLMENT);
    const fulfillment = (await fulfillmentModule.retrieveFulfillment(data.id, {
      relations: ["order"],
    })) as {
      id?: string;
      tracking_numbers?: string[];
      order?: {
        id?: string;
        display_id?: number;
        shipping_address?: { phone?: string | null } | null;
      } | null;
    };

    const order = fulfillment.order;
    if (!order) return;

    const phone = order.shipping_address?.phone?.trim();
    if (!phone) return;

    const displayId = order.display_id ?? order.id ?? "";
    const trackingNumber = fulfillment.tracking_numbers?.[0]?.trim();
    const trackingUrl = `${storefrontUrl}/track/${order.id}`;

    if (process.env.INNGEST_EVENT_KEY) {
      await inngest.send({
        name: "universal-music-store/fulfillment.created",
        data: { phone, displayId, trackingNumber, trackingUrl },
      });
    } else {
      const { sendSms, formatOrderShippedSms } = await import("../lib/semaphore-sms-client.js");
      const message = formatOrderShippedSms({
        displayId,
        trackingNumber,
        courierName: "J&T Express",
        trackingUrl,
      });
      const result = await sendSms({ number: phone, message });
      if (!result.ok) {
        console.error(`[sms] fulfillment_created send failed id=${fulfillment.id} error=${result.error ?? "unknown"}`);
      }
    }
  } catch (err) {
    console.error("[sms] fulfillment_created subscriber error:", err);
  }
}

export const config: SubscriberConfig = {
  event: "fulfillment.created",
};
