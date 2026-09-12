import { sendResendTransactionalEmail } from "@universal-music-store/resend-mail";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  finishPublicDeliveryAttempt,
  publicDeliveryIdempotencyKey,
  recordPublicDeliveryAttempt,
  isEmailUnsubscribed,
} from "@/lib/public-delivery";

export type BackInStockSubscription = {
  id: string;
  email: string;
  product_slug: string;
  variant_id: string | null;
};

export async function dispatchBackInStockNotifications(
  supabase: SupabaseClient,
  subscriptions: BackInStockSubscription[],
  deps: {
    apiKey: string;
    from: string;
    siteOrigin: string;
    send?: typeof sendResendTransactionalEmail;
    nowIso?: () => string;
  },
): Promise<{ sent: number; failed: number }> {
  const send = deps.send ?? sendResendTransactionalEmail;
  let sent = 0;
  let failed = 0;
  for (const subscription of subscriptions) {
    const key = publicDeliveryIdempotencyKey("back_in_stock", subscription.id);
    await recordPublicDeliveryAttempt(supabase, {
      kind: "back_in_stock",
      aggregateId: subscription.id,
      recipient: subscription.email,
      provider: "resend",
      idempotencyKey: key,
    });
    if (await isEmailUnsubscribed(supabase, subscription.email)) {
      await finishPublicDeliveryAttempt(supabase, key, {
        status: "suppressed",
        error: "Recipient unsubscribed",
      });
      await supabase.from("back_in_stock_notifications")
        .update({ notified: true, notified_at: deps.nowIso?.() ?? new Date().toISOString() })
        .eq("id", subscription.id);
      continue;
    }
    const productUrl = `${deps.siteOrigin.replace(/\/$/, "")}/shop/${encodeURIComponent(subscription.product_slug)}`;
    const result = await send({
      apiKey: deps.apiKey,
      from: deps.from,
      to: subscription.email,
      subject: "An item you wanted is back in stock",
      html: `<p>${subscription.product_slug} is back in stock.</p><p><a href="${productUrl}">Shop now</a></p>`,
      idempotencyKey: key,
    });
    await finishPublicDeliveryAttempt(supabase, key, result.ok
      ? { status: "sent", providerMessageId: result.id ?? null, sentAt: deps.nowIso?.() }
      : { status: "failed", error: result.message });
    if (result.ok) {
      await supabase
        .from("back_in_stock_notifications")
        .update({ notified: true, notified_at: deps.nowIso?.() ?? new Date().toISOString() })
        .eq("id", subscription.id);
      sent += 1;
    } else failed += 1;
  }
  return { sent, failed };
}
