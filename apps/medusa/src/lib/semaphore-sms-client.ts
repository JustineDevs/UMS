/**
 * Semaphore.ph SMS API client.
 * Documentation: https://semaphore.co/docs
 *
 * Only active when SEMAPHORE_API_KEY is set. Missing key silently skips sends
 * so development without credentials does not crash the app.
 */

const SEMAPHORE_API = "https://api.semaphore.co/api/v4/messages";

export type SmsMessage = {
  number: string;
  message: string;
  /** Sender name — 11 chars max. Defaults to SEMAPHORE_SENDER_NAME or "UNIMUSIC". */
  senderName?: string;
};

export type SmsSendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

export function safeTrackingUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.search || url.hash) return null;
    return /^\/track\/cap_[A-Za-z0-9._~-]+$/.test(url.pathname) ? url.toString() : null;
  } catch {
    return null;
  }
}

function sanitizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `63${digits.slice(1)}`;
  if (digits.length === 10) return `63${digits}`;
  return digits;
}

export async function sendSms(msg: SmsMessage): Promise<SmsSendResult> {
  const apiKey = process.env.SEMAPHORE_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "SEMAPHORE_API_KEY not configured" };
  }

  const senderName = (
    msg.senderName?.trim() ||
    process.env.SEMAPHORE_SENDER_NAME?.trim() ||
    "UNIMUSIC"
  ).slice(0, 11);

  const phone = sanitizePhone(msg.number);

  try {
    const body = new URLSearchParams({
      apikey: apiKey,
      number: phone,
      message: msg.message,
      sendername: senderName,
    });

    const res = await fetch(SEMAPHORE_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Semaphore HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    const json = (await res.json()) as Array<{ message_id?: number; status?: string }> | { error?: string };

    if (Array.isArray(json) && json.length > 0) {
      const first = json[0];
      return { ok: true, messageId: first.message_id ? String(first.message_id) : undefined };
    }

    if (!Array.isArray(json) && json.error) {
      return { ok: false, error: json.error };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function formatOrderPlacedSms(params: {
  displayId: number | string;
  total: number;
  currencyCode: string;
  storeName?: string;
  trackingUrl?: string;
}): string {
  const store = params.storeName || process.env.STORE_NAME?.trim() || "Universal Music Store";
  const amount = (params.total / 100).toLocaleString("en-PH", {
    style: "currency",
    currency: params.currencyCode.toUpperCase() || "PHP",
    minimumFractionDigits: 2,
  });
  const lines = [
    `${store}: Order #${params.displayId} confirmed!`,
    `Total: ${amount}.`,
  ];
  const trackingUrl = safeTrackingUrl(params.trackingUrl);
  if (trackingUrl) {
    lines.push(`Track: ${trackingUrl}`);
  }
  return lines.join(" ");
}

export function formatOrderShippedSms(params: {
  displayId: number | string;
  trackingNumber?: string;
  courierName?: string;
  trackingUrl?: string;
  storeName?: string;
}): string {
  const store = params.storeName || process.env.STORE_NAME?.trim() || "Universal Music Store";
  const parts = [`${store}: Order #${params.displayId} has shipped!`];
  if (params.courierName && params.trackingNumber) {
    parts.push(`${params.courierName} tracking: ${params.trackingNumber}.`);
  } else if (params.trackingNumber) {
    parts.push(`Tracking: ${params.trackingNumber}.`);
  }
  const trackingUrl = safeTrackingUrl(params.trackingUrl);
  if (trackingUrl) {
    parts.push(`Track: ${trackingUrl}`);
  }
  return parts.join(" ");
}
