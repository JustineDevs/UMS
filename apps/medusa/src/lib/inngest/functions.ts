import { inngest } from "./client";
import { sendSms, formatOrderPlacedSms, formatOrderShippedSms } from "../semaphore-sms-client";

type OrderPlacedData = {
  phone: string;
  displayId: string | number;
  total: number;
  currencyCode: string;
  trackingUrl?: string;
};

type FulfillmentCreatedData = {
  phone: string;
  displayId: string | number;
  trackingNumber?: string;
  trackingUrl?: string;
};

type CampaignSendBatchData = {
  campaignId: string;
  recipients: Array<{ phone: string; message: string }>;
};

/**
 * Background job: Send SMS confirmation after an order is placed.
 * Retries up to 3 times with exponential backoff on failure.
 */
export const orderPlacedSmsJob = inngest.createFunction(
  {
    id: "order-placed-sms",
    name: "Send Order Placed SMS",
    retries: 3,
    trigger: { event: "universal-music-store/order.placed" },
  } as Parameters<typeof inngest.createFunction>[0],
  async ({ event }: { event: { data: OrderPlacedData } }) => {
    const { phone, displayId, total, currencyCode, trackingUrl } = event.data;
    if (!phone) return { skipped: "no phone" };
    const message = formatOrderPlacedSms({ displayId, total, currencyCode, trackingUrl });
    const result = await sendSms({ number: phone, message });
    if (!result.ok) throw new Error(`SMS send failed: ${result.error}`);
    return { ok: true, messageId: result.messageId };
  },
);

/**
 * Background job: Send SMS shipment notification after a fulfillment is created.
 */
export const fulfillmentCreatedSmsJob = inngest.createFunction(
  {
    id: "fulfillment-created-sms",
    name: "Send Fulfillment Created SMS",
    retries: 3,
    trigger: { event: "universal-music-store/fulfillment.created" },
  } as Parameters<typeof inngest.createFunction>[0],
  async ({ event }: { event: { data: FulfillmentCreatedData } }) => {
    const { phone, displayId, trackingNumber, trackingUrl } = event.data;
    if (!phone) return { skipped: "no phone" };
    const message = formatOrderShippedSms({
      displayId,
      trackingNumber,
      courierName: "J&T Express",
      trackingUrl,
    });
    const result = await sendSms({ number: phone, message });
    if (!result.ok) throw new Error(`SMS send failed: ${result.error}`);
    return { ok: true, messageId: result.messageId };
  },
);

/**
 * Background job: Send marketing campaign batch with per-step checkpointing.
 * Processes recipients individually so Inngest can resume on failure
 * without re-sending to already-sent recipients.
 */
export const campaignSendBatchJob = inngest.createFunction(
  {
    id: "campaign-send-batch",
    name: "Send Campaign SMS Batch",
    retries: 2,
    concurrency: { limit: 5 },
    trigger: { event: "universal-music-store/campaign.send.batch" },
  } as Parameters<typeof inngest.createFunction>[0],
  async ({
    event,
    step,
  }: {
    event: { data: CampaignSendBatchData };
    step: { run: <T>(id: string, fn: () => Promise<T>) => Promise<T> };
  }) => {
    const { campaignId, recipients } = event.data;
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return { campaignId, sent: 0, failed: 0 };
    }
    let sent = 0;
    let failed = 0;
    for (const recipient of recipients) {
      const result = await step.run(
        `send-sms-${recipient.phone.slice(-4)}`,
        async () => sendSms({ number: recipient.phone, message: recipient.message }),
      );
      if (result.ok) sent++; else failed++;
    }
    return { campaignId, sent, failed };
  },
);

export const allFunctions = [
  orderPlacedSmsJob,
  fulfillmentCreatedSmsJob,
  campaignSendBatchJob,
];
