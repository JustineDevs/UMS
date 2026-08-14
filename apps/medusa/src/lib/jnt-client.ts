import crypto from "node:crypto";

type JntAddress = {
  name: string;
  mobile: string;
  phone?: string;
  prov: string;
  city: string;
  area: string;
  address: string;
};

export type JntCreateOrderInput = {
  orderNumber: string;
  trackingNumber: string;
  itemCount: number;
  goodsDescription: string;
  declaredValue: number;
  weightKg: number;
  sender?: Partial<JntAddress> | null;
  receiver: Partial<JntAddress>;
  remarks?: string;
};

type JntTrackingInput = {
  trackingNumber: string;
  orderId: string;
  customerName?: string;
  customerPhone?: string;
};

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(
      `[jnt-client] Required environment variable ${key} is not set. Configure J&T Open Platform credentials before using tracking.`,
    );
  }
  return value;
}

function optionalEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function defaultPickupSender(): JntAddress {
  return {
    name: optionalEnv("JNT_PICKUP_NAME") ?? "Universal Music Store",
    mobile: optionalEnv("JNT_PICKUP_PHONE") ?? "",
    phone: optionalEnv("JNT_PICKUP_PHONE") ?? "",
    prov: optionalEnv("JNT_PICKUP_PROVINCE") ?? "CAVITE",
    city: optionalEnv("JNT_PICKUP_CITY") ?? "GENERAL TRIAS",
    area: optionalEnv("JNT_PICKUP_AREA") ?? "NAVARRO",
    address:
      optionalEnv("JNT_PICKUP_ADDRESS") ??
      "B16 L45 ACM Paramount Homes, Brgy. Navarro, General Trias, Cavite",
  };
}

function normalizeAddress(address: Partial<JntAddress>): JntAddress {
  const fallback = defaultPickupSender();
  return {
    name: address.name?.trim() || fallback.name,
    mobile: address.mobile?.trim() || fallback.mobile,
    phone: address.phone?.trim() || address.mobile?.trim() || fallback.phone,
    prov: address.prov?.trim() || fallback.prov,
    city: address.city?.trim() || fallback.city,
    area: address.area?.trim() || fallback.area,
    address: address.address?.trim() || fallback.address,
  };
}

function buildDigest(bodyString: string, apiSecret: string): string {
  return crypto.createHash("md5").update(bodyString + apiSecret).digest("base64");
}

function isSuccessfulJntResponse(json: Record<string, unknown>): boolean {
  const code = json.code;
  const status = json.status;
  const success = json.success;
  return code === 0 || code === "0" || code === 1 || code === "1" || success === true || status === "success";
}

async function jntPost<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const baseUrl =
    process.env.JNT_API_URL?.trim() ||
    "https://demoopenapi.jtexpress.ph/webopenplatformapi";
  const apiAccount = optionalEnv("JNT_API_ACCOUNT") ?? optionalEnv("JNT_API_KEY");
  if (!apiAccount) {
    throw new Error(
      "[jnt-client] Required environment variable JNT_API_ACCOUNT or JNT_API_KEY is not set. Configure J&T Open Platform credentials before using tracking.",
    );
  }
  const apiSecret = requireEnv("JNT_API_SECRET");
  const customerCode = optionalEnv("JNT_CUSTOMER_CODE");

  const requestBody = customerCode ? { ...payload, customerCode } : payload;
  const bodyString = JSON.stringify(requestBody);
  const digest = buildDigest(bodyString, apiSecret);

  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apiAccount,
      digest,
    },
    body: bodyString,
  });

  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok || !isSuccessfulJntResponse(json)) {
    const code = String(json.code ?? response.status);
    const message = String(json.msg ?? json.message ?? response.statusText);
    throw new Error(`[jnt-client] J&T API error: code=${code} message=${message}`);
  }

  return json as T;
}

function buildOrderPayload(input: JntCreateOrderInput): Record<string, unknown> {
  const sender = normalizeAddress(input.sender ?? {});
  const receiver = normalizeAddress(input.receiver);
  const qty = Math.max(1, Math.floor(input.itemCount || 1));
  const weight = Number.isFinite(input.weightKg) ? Math.max(0, input.weightKg) : 0;
  const declaredValue = Number.isFinite(input.declaredValue) ? Math.max(0, input.declaredValue) : 0;
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const apiUrl = optionalEnv("JNT_API_URL") ?? "https://demoopenapi.jtexpress.ph/webopenplatformapi";
  const defaultEnvironment = apiUrl.includes("demo") ? "production:no" : "production:yes";

  return {
    actiontype: "add",
    // The demo endpoint is the safe local default; live requests require an explicit URL or override.
    environment: optionalEnv("JNT_ENVIRONMENT") ?? defaultEnvironment,
    eccompanyid: optionalEnv("JNT_EC_COMPANY_ID") ?? undefined,
    customerid: optionalEnv("JNT_CUSTOMER_ID") ?? undefined,
    txlogisticid: input.orderNumber,
    ordertype: "1",
    servicetype: optionalEnv("JNT_SERVICE_TYPE") ?? "6",
    deliverytype: optionalEnv("JNT_DELIVERY_TYPE") ?? "1",
    sender,
    receiver,
    createordertime: now,
    paytype: optionalEnv("JNT_PAY_TYPE") ?? "1",
    weight: weight.toFixed(2),
    itemsvalue: declaredValue.toFixed(2),
    totalquantity: String(qty),
    remark: input.remarks ?? input.goodsDescription,
    items: [
      {
        itemname: input.goodsDescription,
        number: String(qty),
        itemvalue: declaredValue.toFixed(2),
        desc: input.goodsDescription,
      },
    ],
  };
}

export async function createJntOrder(
  input: JntCreateOrderInput,
): Promise<Record<string, unknown>> {
  return jntPost<Record<string, unknown>>("/api/order/addOrder", buildOrderPayload(input));
}

async function cancelJntOrder(
  orderNumber: string,
  reason?: string,
): Promise<Record<string, unknown>> {
  return jntPost<Record<string, unknown>>("/api/order/cancelOrder", {
    customerTxId: orderNumber,
    ...(reason ? { reason } : {}),
  });
}

async function getJntOrders(
  billCodes: string | string[],
): Promise<Record<string, unknown>> {
  return jntPost<Record<string, unknown>>("/api/order/getOrders", {
    billCodes: Array.isArray(billCodes) ? billCodes.join(",") : billCodes,
  });
}

async function printJntOrder(
  billCodes: string | string[],
): Promise<Record<string, unknown>> {
  return jntPost<Record<string, unknown>>("/api/order/printOrder", {
    billCodes: Array.isArray(billCodes) ? billCodes.join(",") : billCodes,
  });
}

async function trackJntOrder(
  billCodes: string | string[],
): Promise<Record<string, unknown>> {
  return jntPost<Record<string, unknown>>("/api/logistics/trace", {
    billCodes: Array.isArray(billCodes) ? billCodes.join(",") : billCodes,
  });
}

/**
 * Backward-compatible wrapper used by the fulfillment subscriber.
 * Creates the carrier-side order record using the currently available Medusa shipment data.
 */
async function registerJntTracking(
  input: JntTrackingInput,
): Promise<{ trackingNumber: string }> {
  await createJntOrder({
    orderNumber: input.orderId,
    trackingNumber: input.trackingNumber,
    itemCount: 1,
    goodsDescription: `Universal Music Store order ${input.orderId}`,
    declaredValue: 0,
    weightKg: 0.5,
    receiver: {
      name: input.customerName ?? "Customer",
      mobile: input.customerPhone ?? "",
      phone: input.customerPhone ?? "",
      prov: "",
      city: "",
      area: "",
      address: "",
    },
  });

  return { trackingNumber: input.trackingNumber };
}

async function getJntTracking(
  trackingNumber: string,
): Promise<Record<string, unknown> | null> {
  try {
    return await trackJntOrder(trackingNumber);
  } catch {
    return null;
  }
}
