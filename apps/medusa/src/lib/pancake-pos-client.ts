type PancakePosAddress = {
  name: string;
  mobile: string;
  phone?: string;
  prov: string;
  city: string;
  area: string;
  address: string;
};

export type PancakePosCreateOrderInput = {
  orderNumber: string;
  trackingNumber?: string;
  itemCount: number;
  goodsDescription: string;
  declaredValue: number;
  weightKg: number;
  sender?: Partial<PancakePosAddress> | null;
  receiver: Partial<PancakePosAddress>;
  remarks?: string;
};

type OptionalResponseShape = {
  order_id?: string;
  orderId?: string;
  system_id?: number;
  systemId?: number;
  tracking_number?: string;
  trackingNumber?: string;
  tracking_link?: string;
  trackingLink?: string;
  bill_code?: string;
  billCode?: string;
  label_url?: string;
  labelUrl?: string;
  data?: Record<string, unknown>;
  result?: Record<string, unknown>;
};

type PancakePosResult = {
  orderId: string | null;
  systemId: number | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  raw: Record<string, unknown>;
};

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(
      `[pancake-pos-client] Required environment variable ${key} is not set. Configure Pancake POS credentials before using shipment registration.`,
    );
  }
  return value;
}

function optionalEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function defaultPickupSender(): PancakePosAddress {
  return {
    name: optionalEnv("PANCAKE_POS_PICKUP_NAME") ?? "Universal Music Store",
    mobile: optionalEnv("PANCAKE_POS_PICKUP_PHONE") ?? "",
    phone: optionalEnv("PANCAKE_POS_PICKUP_PHONE") ?? "",
    prov: optionalEnv("PANCAKE_POS_PICKUP_PROVINCE") ?? "CAVITE",
    city: optionalEnv("PANCAKE_POS_PICKUP_CITY") ?? "GENERAL TRIAS",
    area: optionalEnv("PANCAKE_POS_PICKUP_AREA") ?? "NAVARRO",
    address:
      optionalEnv("PANCAKE_POS_PICKUP_ADDRESS") ??
      "B16 L45 ACM Paramount Homes, Brgy. Navarro, General Trias, Cavite",
  };
}

function normalizeAddress(address: Partial<PancakePosAddress>): PancakePosAddress {
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

function isSuccessfulPancakeResponse(json: Record<string, unknown>): boolean {
  const code = json.code;
  const status = json.status;
  const success = json.success;
  return code === 0 || code === "0" || code === 1 || code === "1" || success === true || status === "success";
}

function getBaseUrl(): string {
  return (
    optionalEnv("PANCAKE_POS_API_URL") ||
    "https://pos.pages.fm/api/v1"
  );
}

function getShopId(): string {
  return requireEnv("PANCAKE_POS_SHOP_ID");
}

function getApiKey(): string {
  return requireEnv("PANCAKE_POS_API_KEY");
}

function mergePancakePayload(input: PancakePosCreateOrderInput): Record<string, unknown> {
  const sender = normalizeAddress(input.sender ?? {});
  const receiver = normalizeAddress(input.receiver);
  const qty = Math.max(1, Math.floor(input.itemCount || 1));
  const weight = Number.isFinite(input.weightKg) ? Math.max(0, input.weightKg) : 0;
  const declaredValue = Number.isFinite(input.declaredValue) ? Math.max(0, input.declaredValue) : 0;

  const payload: Record<string, unknown> = {
    order_number: input.orderNumber,
    external_order_number: input.orderNumber,
    customer_order_number: input.orderNumber,
    cod_amount: declaredValue.toFixed(2),
    weight: weight.toFixed(2),
    total_quantity: String(qty),
    goods_description: input.goodsDescription,
    remarks: input.remarks ?? input.goodsDescription,
    sender,
    receiver,
    items: [
      {
        item_name: input.goodsDescription,
        number: String(qty),
        value: declaredValue.toFixed(2),
        description: input.goodsDescription,
      },
    ],
  };
  if (input.trackingNumber?.trim()) {
    payload.tracking_number = input.trackingNumber.trim();
  }

  return payload;
}

async function pancakeRequest(path: string, payload?: Record<string, unknown>, method = "POST"): Promise<Record<string, unknown>> {
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  const url = new URL(`${baseUrl}${path}`);
  url.searchParams.set("api_key", getApiKey());

  const init: RequestInit = { method };
  if (payload) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(payload);
  }

  const response = await fetch(url, init);
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || !isSuccessfulPancakeResponse(json)) {
    const code = String(json.code ?? response.status);
    const message = String(json.msg ?? json.message ?? response.statusText);
    throw new Error(`[pancake-pos-client] Pancake API error: code=${code} message=${message}`);
  }
  return json;
}

function extractResponseData(json: Record<string, unknown>): OptionalResponseShape & Record<string, unknown> {
  const top = json;
  const nested = [
    top.data,
    top.result,
    top.order,
    top.orders,
  ].find((value) => value && typeof value === "object" && !Array.isArray(value)) as Record<string, unknown> | undefined;
  return { ...top, ...(nested ?? {}) } as OptionalResponseShape & Record<string, unknown>;
}

function pickId(json: OptionalResponseShape & Record<string, unknown>): string | null {
  const candidates = [
    json.order_id,
    json.orderId,
    json.id,
    json.order_no,
    json.orderNo,
    json.bill_code,
    json.billCode,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function pickSystemId(json: OptionalResponseShape & Record<string, unknown>): number | null {
  const candidates: Array<unknown> = [json.system_id, json.systemId];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function pickTrackingNumber(json: OptionalResponseShape & Record<string, unknown>): string | null {
  const candidates = [
    json.tracking_number,
    json.trackingNumber,
    json.bill_code,
    json.billCode,
    json.tracking_code,
    json.trackingCode,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickTrackingUrl(json: OptionalResponseShape & Record<string, unknown>): string | null {
  const candidates = [json.tracking_link, json.trackingLink];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickLabelUrl(json: OptionalResponseShape & Record<string, unknown>): string | null {
  const candidates = [json.label_url, json.labelUrl, json.print_url, json.printUrl];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function createPancakePosOrder(
  input: PancakePosCreateOrderInput,
): Promise<PancakePosResult> {
  const json = await pancakeRequest(
    `/shops/${encodeURIComponent(getShopId())}/orders`,
    mergePancakePayload(input),
  );
  const data = extractResponseData(json);
  return {
    orderId: pickId(data),
    systemId: pickSystemId(data),
    trackingNumber: pickTrackingNumber(data) ?? input.trackingNumber?.trim() ?? null,
    trackingUrl: pickTrackingUrl(data),
    labelUrl: pickLabelUrl(data),
    raw: json,
  };
}

export async function arrangePancakePosShipment(
  orderId: string,
  options?: {
    pickupMethod?: "pick_up" | "drop_off";
    pickupShift?: "closest" | "farthest";
  },
): Promise<Record<string, unknown>> {
  const payload: Record<string, unknown> = {
    order_id: orderId,
  };
  if (options?.pickupMethod) {
    payload.pickup_method = options.pickupMethod;
  }
  if (options?.pickupShift) {
    payload.pickup_shift = options.pickupShift;
  }
  return pancakeRequest(`/shops/${encodeURIComponent(getShopId())}/orders/arrange_shipment`, payload);
}

export async function getPancakePosTrackingUrl(systemId: number): Promise<Record<string, unknown>> {
  return pancakeRequest(
    `/shops/${encodeURIComponent(getShopId())}/orders/get_tracking_url`,
    { system_id: systemId },
  );
}

export async function listPancakePosOrders(): Promise<Record<string, unknown>> {
  return pancakeRequest(`/shops/${encodeURIComponent(getShopId())}/orders`, undefined, "GET");
}

export async function getPancakePosOrder(orderId: string): Promise<Record<string, unknown>> {
  return pancakeRequest(
    `/shops/${encodeURIComponent(getShopId())}/orders/${encodeURIComponent(orderId)}`,
    undefined,
    "GET",
  );
}

export async function registerPancakePosTracking(input: {
  orderId: string;
  trackingNumber: string;
  customerName?: string;
  customerPhone?: string;
  sender?: Partial<PancakePosAddress> | null;
  receiver?: Partial<PancakePosAddress> | null;
  declaredValue?: number;
  weightKg?: number;
  itemCount?: number;
  goodsDescription?: string;
  remarks?: string;
}): Promise<PancakePosResult> {
  const created = await createPancakePosOrder({
    orderNumber: input.orderId,
    trackingNumber: input.trackingNumber,
    itemCount: input.itemCount ?? 1,
    goodsDescription: input.goodsDescription ?? `Universal Music Store order ${input.orderId}`,
    declaredValue: input.declaredValue ?? 0,
    weightKg: input.weightKg ?? 0.5,
    sender: input.sender ?? undefined,
    receiver: input.receiver ?? {
      name: input.customerName ?? "Customer",
      mobile: input.customerPhone ?? "",
      phone: input.customerPhone ?? "",
      prov: "",
      city: "",
      area: "",
      address: "",
    },
    remarks: input.remarks,
  });
  if (created.orderId) {
    await arrangePancakePosShipment(created.orderId, { pickupMethod: "pick_up" });
  }
  return created;
}
