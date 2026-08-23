import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { safeLogIdentifier } from "../lib/safe-log";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { sendResendTransactionalEmail } from "../lib/resend-email";
import { emitOrderPlacedFunnelEvent } from "../lib/commerce-funnel-sink";
import { safeTrackingUrl } from "../lib/semaphore-sms-client";
import { inngest } from "../lib/inngest/client";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCurrency(cents: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: currencyCode.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${currencyCode.toUpperCase()} ${(cents / 100).toFixed(2)}`;
  }
}

type OrderItem = {
  title?: string;
  subtitle?: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
  thumbnail?: string;
};

type ShippingAddress = {
  first_name?: string;
  last_name?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country_code?: string;
  phone?: string;
};

type OrderForEmail = {
  email?: string;
  id?: string;
  display_id?: number;
  total?: number;
  subtotal?: number;
  tax_total?: number;
  shipping_total?: number;
  currency_code?: string;
  created_at?: string;
  customer?: { email?: string } | null;
  items?: OrderItem[];
  shipping_address?: ShippingAddress | null;
};

export function buildRichHtml(params: {
  order: OrderForEmail;
  orderDisplayLabel: string;
  trackingUrl: string;
  brandName: string;
}): string {
  const { order, orderDisplayLabel, trackingUrl, brandName } = params;
  const currency = (order.currency_code ?? "PHP").toUpperCase();
  const items = order.items ?? [];
  const addr = order.shipping_address;

  const itemRows = items
    .map((item) => {
      const name = esc(String(item.title ?? "Item"));
      const qty = Number(item.quantity ?? 1);
      const unitPrice = Number(item.unit_price ?? 0);
      const lineTotal = Number(item.total ?? unitPrice * qty);
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;">
            ${name}
            ${item.subtitle ? `<br><span style="font-size:12px;color:#64748b;">${esc(String(item.subtitle))}</span>` : ""}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#64748b;text-align:center;">${qty}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;text-align:right;white-space:nowrap;">${formatCurrency(unitPrice, currency)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:600;color:#0f172a;text-align:right;white-space:nowrap;">${formatCurrency(lineTotal, currency)}</td>
        </tr>`;
    })
    .join("");

  const subtotal = Number(order.subtotal ?? order.total ?? 0);
  const shippingTotal = Number(order.shipping_total ?? 0);
  const taxTotal = Number(order.tax_total ?? 0);
  const grandTotal = Number(order.total ?? 0);

  const addressBlock = addr
    ? `<p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">
        ${addr.first_name ? esc(String(addr.first_name)) + " " : ""}${addr.last_name ? esc(String(addr.last_name)) : ""}<br>
        ${addr.address_1 ? esc(String(addr.address_1)) + "<br>" : ""}
        ${addr.address_2 ? esc(String(addr.address_2)) + "<br>" : ""}
        ${addr.city ? esc(String(addr.city)) + ", " : ""}${addr.province ? esc(String(addr.province)) + " " : ""}${addr.postal_code ? esc(String(addr.postal_code)) : ""}<br>
        ${addr.country_code ? esc(String(addr.country_code).toUpperCase()) : ""}
        ${addr.phone ? `<br>${esc(String(addr.phone))}` : ""}
      </p>`
    : "<p style=\"margin:0;font-size:14px;color:#64748b;\">No shipping address on file.</p>";

  const orderedAt = order.created_at
    ? new Date(order.created_at).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Order Confirmation — ${esc(orderDisplayLabel)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#f8fafc;letter-spacing:0.5px;">${esc(brandName)}</p>
            <p style="margin:8px 0 0;font-size:13px;color:#94a3b8;">Music retail &amp; gear</p>
          </td>
        </tr>

        <!-- Hero -->
        <tr>
          <td style="padding:40px 40px 28px;text-align:center;border-bottom:1px solid #f1f5f9;">
            <div style="display:inline-block;background:#dcfce7;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px;margin-bottom:16px;">
              &#10003;
            </div>
            <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a;">Order Confirmed</h1>
            <p style="margin:0;font-size:15px;color:#475569;">
              Thank you for your order. We'll notify you when it ships.
            </p>
            ${orderedAt ? `<p style="margin:8px 0 0;font-size:13px;color:#94a3b8;">${esc(orderedAt)}</p>` : ""}
          </td>
        </tr>

        <!-- Order number + track CTA -->
        <tr>
          <td style="padding:24px 40px;text-align:center;border-bottom:1px solid #f1f5f9;background:#f8fafc;">
            <p style="margin:0 0 4px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Order Number</p>
            <p style="margin:0 0 20px;font-size:28px;font-weight:700;color:#0f172a;letter-spacing:1px;">#${esc(orderDisplayLabel)}</p>
            <a href="${esc(trackingUrl)}"
               style="display:inline-block;background:#0f172a;color:#f8fafc;font-size:14px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">
              Track Your Order
            </a>
          </td>
        </tr>

        ${items.length > 0 ? `
        <!-- Items -->
        <tr>
          <td style="padding:32px 40px;">
            <h2 style="margin:0 0 20px;font-size:16px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:1px;">Order Summary</h2>
            <table width="100%" cellpadding="0" cellspacing="0">
              <thead>
                <tr>
                  <th style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;padding-bottom:8px;text-align:left;font-weight:600;">Item</th>
                  <th style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;padding-bottom:8px;text-align:center;font-weight:600;">Qty</th>
                  <th style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;padding-bottom:8px;text-align:right;font-weight:600;">Price</th>
                  <th style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;padding-bottom:8px;text-align:right;font-weight:600;">Total</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>

            <!-- Totals -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
              ${subtotal !== grandTotal ? `
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#475569;">Subtotal</td>
                <td style="padding:6px 0;font-size:14px;color:#475569;text-align:right;">${formatCurrency(subtotal, currency)}</td>
              </tr>` : ""}
              ${shippingTotal > 0 ? `
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#475569;">Shipping</td>
                <td style="padding:6px 0;font-size:14px;color:#475569;text-align:right;">${formatCurrency(shippingTotal, currency)}</td>
              </tr>` : ""}
              ${taxTotal > 0 ? `
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#475569;">Tax</td>
                <td style="padding:6px 0;font-size:14px;color:#475569;text-align:right;">${formatCurrency(taxTotal, currency)}</td>
              </tr>` : ""}
              <tr>
                <td style="padding:12px 0 0;font-size:16px;font-weight:700;color:#0f172a;border-top:2px solid #f1f5f9;">Total</td>
                <td style="padding:12px 0 0;font-size:16px;font-weight:700;color:#0f172a;text-align:right;border-top:2px solid #f1f5f9;">${formatCurrency(grandTotal, currency)}</td>
              </tr>
            </table>
          </td>
        </tr>` : ""}

        ${addr ? `
        <!-- Shipping address -->
        <tr>
          <td style="padding:0 40px 32px;">
            <div style="background:#f8fafc;border-radius:8px;padding:20px 24px;">
              <h3 style="margin:0 0 12px;font-size:13px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:1px;">Shipping To</h3>
              ${addressBlock}
            </div>
          </td>
        </tr>` : ""}

        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">Questions? Reply to this email or contact us at</p>
            <p style="margin:0 0 16px;font-size:12px;color:#0f766e;font-weight:600;">support@universal-music-store.com</p>
            <p style="margin:0;font-size:11px;color:#cbd5e1;">Keep this email for your order records.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function orderPlacedResendEmail({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as {
    warn?: (m: string) => void;
    info?: (m: string) => void;
  };

  const orderModule = container.resolve(Modules.ORDER);
  const order = (await orderModule.retrieveOrder(data.id, {
    relations: ["customer", "items", "shipping_address"],
  })) as OrderForEmail;

  const orderDisplayLabel =
    order.display_id != null ? String(order.display_id) : String(order.id ?? data.id);

  try {
    await emitOrderPlacedFunnelEvent({
      logger: logger as { info?: (msg: string) => void },
      orderId: String(order.id ?? data.id),
      displayId: orderDisplayLabel,
      channel: "store",
    });
  } catch {
    /* funnel sink must not block checkout email */
  }

  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const brand =
    process.env.RESEND_BRAND_NAME?.trim() || "Universal Music Store";
  const storefrontBase =
    process.env.STOREFRONT_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "";

  if (!key || !from || !storefrontBase) {
    return;
  }

  const emailRaw =
    (typeof order.email === "string" && order.email.trim()) ||
    (order.customer &&
    typeof order.customer === "object" &&
    order.customer !== null &&
    "email" in order.customer &&
    typeof order.customer.email === "string"
      ? order.customer.email.trim()
      : "") ||
    "";

  if (!emailRaw) {
    logger.warn?.(`[resend] order ${safeLogIdentifier(data.id)} has no email; skip notification.`);
    return;
  }

  const orderId = String(order.id ?? data.id);
  const { buildTrackingUrl } = await import("@universal-music-store/sdk");
  const trackingUrl = safeTrackingUrl(buildTrackingUrl(storefrontBase, orderId, {
    customerEmail: emailRaw,
    storeId: process.env.DEFAULT_ORGANIZATION_ID?.trim(),
  }) ?? undefined);
  if (!trackingUrl) {
    logger.warn?.(
      `[resend] order ${safeLogIdentifier(orderId)} has no tracking capability secret; skip notification.`,
    );
    return;
  }

  const subject = `Order #${orderDisplayLabel} confirmed — ${brand}`;
  const html = buildRichHtml({
    order,
    orderDisplayLabel,
    trackingUrl,
    brandName: brand,
  });

  if (process.env.INNGEST_EVENT_KEY?.trim()) {
    try {
      await inngest.send({
        name: "universal-music-store/order.confirmation.email",
        data: { from, to: emailRaw, subject, html, orderId },
      });
      return;
    } catch {
      logger.warn?.("[resend] email delivery job enqueue rejected");
      return;
    }
  }

  const sent = await sendResendTransactionalEmail({
    apiKey: key,
    from,
    to: emailRaw,
    subject,
    html,
    tags: [{ name: "type", value: "order_confirmation" }],
    idempotencyKey: `order-confirmation/${orderId}`,
  });

  if (!sent.ok) {
    logger.warn?.("[resend] delivery rejected");
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
