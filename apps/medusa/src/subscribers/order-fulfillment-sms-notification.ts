import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { safeLogIdentifier } from "../lib/safe-log";
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
  const { buildTrackingUrl } = await import("@universal-music-store/sdk");
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
        email?: string | null;
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
    const trackingUrl = order.id ? buildTrackingUrl(storefrontUrl, order.id, {
      customerEmail: order.email ?? undefined,
      storeId: process.env.DEFAULT_ORGANIZATION_ID?.trim(),
    }) : null;
    if (!trackingUrl) {
      console.error("[sms] fulfillment_created tracking capability unavailable; notification skipped");
      return;
    }

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
        console.error(
          `[sms] fulfillment_created send failed id=${safeLogIdentifier(fulfillment.id)} error=provider_rejected`,
        );
      }
    }
  } catch (err) {
    console.error(
      `[sms] fulfillment_created subscriber error: ${err instanceof Error ? err.name : "unknown"}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: "fulfillment.created",
};
