import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { Modules } from "@medusajs/framework/utils";
import { inngest } from "../lib/inngest/client";
import { safeLogIdentifier } from "../lib/safe-log";

/**
 * Fires an Inngest event `universal-music-store/order.placed` when an order is placed.
 * Inngest handles retry logic, backoff, and delivery guarantees.
 * Falls back to direct send if INNGEST_EVENT_KEY is not set.
 */
export default async function orderPlacedSmsNotification({
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
    const orderModule = container.resolve(Modules.ORDER);
    const order = (await orderModule.retrieveOrder(data.id, {
      relations: ["shipping_address"],
    })) as {
      id?: string;
      display_id?: number;
      total?: number;
      currency_code?: string;
      shipping_address?: { phone?: string | null } | null;
      email?: string | null;
    };

    const phone = order.shipping_address?.phone?.trim();
    if (!phone) return;

    const displayId = order.display_id ?? order.id ?? "";
    const total = typeof order.total === "number" ? order.total : 0;
    const currencyCode =
      typeof order.currency_code === "string" ? order.currency_code : "PHP";
    const trackingUrl = order.id ? buildTrackingUrl(storefrontUrl, order.id, {
      customerEmail: order.email ?? undefined,
      storeId: process.env.DEFAULT_ORGANIZATION_ID?.trim(),
    }) : null;
    if (!trackingUrl) {
      console.error("[sms] order_placed tracking capability unavailable; notification skipped");
      return;
    }

    if (process.env.INNGEST_EVENT_KEY) {
      await inngest.send({
        name: "universal-music-store/order.placed",
        data: { phone, displayId, total, currencyCode, trackingUrl },
      });
    } else {
      const { sendSms, formatOrderPlacedSms } = await import("../lib/semaphore-sms-client.js");
      const message = formatOrderPlacedSms({ displayId, total, currencyCode, trackingUrl });
      const result = await sendSms({ number: phone, message });
      if (!result.ok) {
        console.error(
          `[sms] order_placed send failed orderId=${safeLogIdentifier(order.id)} error=provider_rejected`,
        );
      }
    }
  } catch (err) {
    console.error(`[sms] order_placed subscriber error: ${err instanceof Error ? err.name : "unknown"}`);
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
