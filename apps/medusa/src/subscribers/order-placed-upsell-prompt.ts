import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { sendResendTransactionalEmail } from "../lib/resend-email";
import { safeLogIdentifier } from "../lib/safe-log";

export default async function orderPlacedUpsellPrompt({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const fromAddr =
    process.env.RESEND_FROM_EMAIL?.trim() || "noreply@universal-music-store.com";
  const storefrontUrl =
    process.env.STOREFRONT_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "";

  if (!resendKey || !storefrontUrl) return;

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as {
    info?: (m: string) => void;
    warn?: (m: string) => void;
  };

  const orderModule = container.resolve(Modules.ORDER);
  const order = (await orderModule.retrieveOrder(data.id, {
    relations: ["items", "customer"],
  })) as {
    email?: string;
    display_id?: number;
    customer?: { email?: string; first_name?: string } | null;
    items?: Array<{ title?: string; product_id?: string }>;
  };

  const email =
    (typeof order.email === "string" && order.email.trim()) ||
    order.customer?.email?.trim() ||
    "";
  if (!email) return;

  const firstName = order.customer?.first_name ?? "there";
  const purchasedTitles = (order.items ?? [])
    .map((i) => i.title)
    .filter(Boolean)
    .slice(0, 3);

  if (purchasedTitles.length === 0) return;

  const cleanBase = storefrontUrl.replace(/\/$/, "");
  const shopUrl = `${cleanBase}/shop`;

  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#1e293b;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="margin:0">Complete your look</h2>
  <p>Hi ${firstName}, thanks for your recent purchase of ${purchasedTitles.join(", ")}.</p>
  <p>Check out items that pair well with your order:</p>
  <p><a href="${shopUrl}" style="display:inline-block;background:#1e293b;color:white;padding:12px 24px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.05em;text-transform:uppercase">Shop Now</a></p>
  <p style="font-size:12px;color:#94a3b8;margin-top:24px">${process.env.STORE_NAME?.trim() || "Universal Music Store"}</p>
</body></html>`;

  const sent = await sendResendTransactionalEmail({
    apiKey: resendKey,
    from: fromAddr,
    to: email,
    subject: `Complete your look, ${firstName}`,
    html,
    tags: [{ name: "type", value: "order_upsell" }],
  });
  if (sent.ok) {
    logger.info?.(`[upsell] sent cross-sell email to ${safeLogIdentifier(email)}`);
  } else {
    logger.warn?.("[upsell] delivery rejected");
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
