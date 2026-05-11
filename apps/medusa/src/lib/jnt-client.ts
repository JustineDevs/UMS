import crypto from "node:crypto";

export type JntTrackingInput = {
  trackingNumber: string;
  orderId: string;
  customerName?: string;
  customerPhone?: string;
};

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(
      `[jnt-client] Required environment variable ${key} is not set. Configure J&T VIP credentials before using tracking.`,
    );
  }
  return value;
}

function buildSignature(apiKey: string, apiSecret: string, timestamp: number, body: string): string {
  const raw = `${apiKey}${timestamp}${body}${apiSecret}`;
  return crypto.createHash("md5").update(raw).digest("hex").toLowerCase();
}

async function jntPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const baseUrl = requireEnv("JNT_API_URL");
  const apiKey = requireEnv("JNT_API_KEY");
  const apiSecret = requireEnv("JNT_API_SECRET");
  const customerCode = requireEnv("JNT_CUSTOMER_CODE");

  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({ ...body, customerCode });
  const signature = buildSignature(apiKey, apiSecret, timestamp, payload);

  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
      "X-Timestamp": String(timestamp),
      "X-Signature": signature,
    },
    body: payload,
  });

  const json = (await response.json()) as Record<string, unknown>;

  if (!response.ok || json.code !== "0" && json.code !== 0) {
    const code = String(json.code ?? response.status);
    const message = String(json.message ?? json.msg ?? response.statusText);
    throw new Error(`[jnt-client] J&T API error: code=${code} message=${message}`);
  }

  return json as T;
}

/**
 * Register a tracking number with J&T VIP API.
 * Called on fulfillment_created so J&T begins tracking the parcel.
 */
export async function registerJntTracking(
  input: JntTrackingInput,
): Promise<{ trackingNumber: string }> {
  const body: Record<string, unknown> = {
    billCode: input.trackingNumber,
    orderNo: input.orderId,
  };
  if (input.customerName) body.consigneeName = input.customerName;
  if (input.customerPhone) body.consigneePhone = input.customerPhone;

  await jntPost<Record<string, unknown>>("/tracking/register", body);

  return { trackingNumber: input.trackingNumber };
}

/**
 * Query the current tracking status for a tracking number from J&T VIP API.
 * Used for admin polling and manual refresh.
 */
export async function getJntTracking(
  trackingNumber: string,
): Promise<Record<string, unknown> | null> {
  try {
    const result = await jntPost<Record<string, unknown>>("/tracking/query", {
      billCode: trackingNumber,
    });
    return result;
  } catch {
    return null;
  }
}
