import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { tryCreateSupabaseClient } from "../lib/payment-supabase-bridge";
import { buildReceiptHtml, markReceiptSent, saveReceipt } from "../lib/digital-receipt";
import { sendResendTransactionalEmail } from "../lib/resend-email";

export default async function orderPlacedDigitalReceipt({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const sb = tryCreateSupabaseClient();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const fromAddr =
    process.env.RESEND_FROM_EMAIL?.trim() || "noreply@universal-music-store.com";

  if (!sb) return;

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as {
    info?: (m: string) => void;
    warn?: (m: string) => void;
  };

  const orderModule = container.resolve(Modules.ORDER);
  const order = (await orderModule.retrieveOrder(data.id, {
    relations: ["items"],
  })) as {
    id?: string;
    display_id?: number;
    email?: string;
    total?: number;
    currency_code?: string;
    created_at?: string;
    items?: Array<{
      title?: string;
      quantity?: number;
      unit_price?: number;
    }>;
  };

  const email = typeof order.email === "string" ? order.email.trim() : "";
  const items = (order.items ?? []).map((i) => ({
    title: String(i.title ?? "Item"),
    quantity: Number(i.quantity ?? 1),
    unit_price: Number(i.unit_price ?? 0),
  }));

  try {
    const html = buildReceiptHtml({
      id: order.id ?? data.id,
      display_id: order.display_id,
      items,
      total: Number(order.total ?? 0),
      currency_code: order.currency_code ?? "php",
      created_at: order.created_at,
      storeName: process.env.STORE_NAME?.trim() || "Universal Music Store",
    });

    const receipt = await saveReceipt(sb, {
      order_id: order.id ?? data.id,
      customer_email: email || undefined,
      receipt_html: html,
    });

    if (email && resendKey) {
      const sent = await sendResendTransactionalEmail({
        apiKey: resendKey,
        from: fromAddr,
        to: email,
        subject: `Your receipt for Order #${order.display_id ?? order.id ?? data.id}`,
        html,
        tags: [{ name: "type", value: "digital_receipt" }],
      });
      if (sent.ok) {
        await markReceiptSent(sb, receipt.id);
        logger.info?.(`[receipt] sent to ${email} for order ${data.id}`);
      } else {
        logger.warn?.(`[receipt] Resend failed for ${email}: ${sent.message}`);
      }
    }
  } catch (err) {
    logger.warn?.(`[receipt] ${err instanceof Error ? err.message : String(err)}`);
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
