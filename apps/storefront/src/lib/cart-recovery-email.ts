import { sendResendTransactionalEmail } from "@universal-music-store/resend-mail";
import { DEFAULT_PUBLIC_SITE_ORIGIN } from "@universal-music-store/sdk";

function cartRecoveryEnabled(): boolean {
  return process.env.STOREFRONT_CART_RECOVERY_EMAIL?.trim() === "1";
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * Sends a single recovery nudge via Resend when STOREFRONT_CART_RECOVERY_EMAIL=1
 * and RESEND_API_KEY plus RESEND_FROM_EMAIL are set.
 */
export async function sendCartRecoveryEmail(params: {
  to: string;
  lineCount: number;
}): Promise<boolean> {
  if (!cartRecoveryEnabled()) return false;
  const to = params.to.trim().toLowerCase();
  if (!isEmail(to)) return false;
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!key || !from) return false;

  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_PUBLIC_SITE_ORIGIN
  ).replace(/\/$/, "");
  const resumeUrl = `${origin}/checkout`;

  const result = await sendResendTransactionalEmail({
    apiKey: key,
    from,
    to,
    subject: "You left items in your bag",
    html: `<p>Hi,</p>
<p>You still have <strong>${params.lineCount}</strong> line item${
      params.lineCount === 1 ? "" : "s"
    } in your bag at Universal Music Store.</p>
<p><a href="${resumeUrl}">Return to checkout</a> when you are ready. If you did not intend to leave items behind, you can ignore this message.</p>
<p>Thank you,<br/>Universal Music Store</p>`,
    tags: [{ name: "type", value: "cart_recovery" }],
  });
  return result.ok;
}
