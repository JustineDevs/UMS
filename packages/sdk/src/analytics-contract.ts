export type PrivacyTier = "public" | "internal" | "pii" | "financial";

export type MetricWindow = {
  /** UTC, inclusive start and exclusive end. */
  start: string;
  end: string;
  timezone: "UTC";
};

export type CanonicalMetricContract = {
  name: "revenue" | "orders" | "customers" | "refunds";
  source: "medusa_orders" | "medusa_refunds";
  window: MetricWindow;
  currency: string;
  amountBasis: "order_total_minus_refunds" | "order_total" | "refund_total";
};

export function createCanonicalMetricContract(input: Omit<CanonicalMetricContract, "currency"> & { currency: string }): CanonicalMetricContract {
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Metric currency must be an ISO 4217 code");
  if (input.window.timezone !== "UTC" || Date.parse(input.window.start) >= Date.parse(input.window.end)) {
    throw new Error("Metric window must be a UTC half-open interval");
  }
  return { ...input, currency };
}

export type CommerceAttribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  campaignId?: string;
  couponCode?: string;
  referralCode?: string;
};

export function normalizeCommerceAttribution(input?: CommerceAttribution): CommerceAttribution {
  const clean = (value: string | undefined) => value?.trim().slice(0, 120) || undefined;
  return {
    source: clean(input?.source), medium: clean(input?.medium), campaign: clean(input?.campaign),
    campaignId: clean(input?.campaignId), couponCode: clean(input?.couponCode)?.toUpperCase(),
    referralCode: clean(input?.referralCode),
  };
}

export type AnalyticsEventDef = {
  name: string;
  source: "storefront" | "admin" | "api" | "medusa" | "pos";
  privacyTier: PrivacyTier;
  properties: Record<string, { type: string; required: boolean; pii: boolean }>;
};

export const ANALYTICS_EVENT_SCHEMA: AnalyticsEventDef[] = [
  {
    name: "page_view",
    source: "storefront",
    privacyTier: "public",
    properties: {
      path: { type: "string", required: true, pii: false },
      referrer: { type: "string", required: false, pii: false },
      user_agent: { type: "string", required: false, pii: false },
    },
  },
  {
    name: "product_view",
    source: "storefront",
    privacyTier: "public",
    properties: {
      product_id: { type: "string", required: true, pii: false },
      product_name: { type: "string", required: true, pii: false },
      category_id: { type: "string", required: false, pii: false },
      price_minor: { type: "number", required: false, pii: false },
    },
  },
  {
    name: "add_to_cart",
    source: "storefront",
    privacyTier: "internal",
    properties: {
      product_id: { type: "string", required: true, pii: false },
      variant_id: { type: "string", required: true, pii: false },
      quantity: { type: "number", required: true, pii: false },
      cart_id: { type: "string", required: true, pii: false },
    },
  },
  {
    name: "checkout_started",
    source: "storefront",
    privacyTier: "internal",
    properties: {
      cart_id: { type: "string", required: true, pii: false },
      total_minor: { type: "number", required: true, pii: false },
      payment_provider: { type: "string", required: true, pii: false },
      item_count: { type: "number", required: true, pii: false },
    },
  },
  {
    name: "order_placed",
    source: "medusa",
    privacyTier: "financial",
    properties: {
      order_id: { type: "string", required: true, pii: false },
      customer_id: { type: "string", required: true, pii: true },
      total_minor: { type: "number", required: true, pii: false },
      currency: { type: "string", required: true, pii: false },
      payment_provider: { type: "string", required: true, pii: false },
      item_count: { type: "number", required: true, pii: false },
    },
  },
  {
    name: "search_query",
    source: "storefront",
    privacyTier: "internal",
    properties: {
      query: { type: "string", required: true, pii: false },
      results_count: { type: "number", required: true, pii: false },
    },
  },
  {
    name: "staff_action",
    source: "admin",
    privacyTier: "internal",
    properties: {
      action: { type: "string", required: true, pii: false },
      resource: { type: "string", required: true, pii: false },
      staff_id: { type: "string", required: true, pii: true },
    },
  },
  {
    name: "pos_sale",
    source: "pos",
    privacyTier: "financial",
    properties: {
      order_id: { type: "string", required: true, pii: false },
      store_id: { type: "string", required: true, pii: false },
      total_minor: { type: "number", required: true, pii: false },
      payment_method: { type: "string", required: true, pii: false },
    },
  },
];

export type AnalyticsEvent = {
  name: string;
  timestamp: string;
  source: string;
  sessionId?: string;
  properties: Record<string, unknown>;
};

export function createAnalyticsEvent(
  name: string,
  source: string,
  properties: Record<string, unknown>,
  sessionId?: string,
): AnalyticsEvent {
  const schema = ANALYTICS_EVENT_SCHEMA.find((definition) => definition.name === name);
  if (!schema || schema.source !== source) {
    throw new Error(`Unknown analytics event or source mismatch: ${source}:${name}`);
  }
  for (const [key, definition] of Object.entries(schema.properties)) {
    const value = properties[key];
    if (definition.required && value === undefined) {
      throw new Error(`Missing required analytics property: ${name}.${key}`);
    }
    if (value !== undefined && (definition.type === "number" ? typeof value !== "number" : typeof value !== definition.type)) {
      throw new Error(`Invalid analytics property type: ${name}.${key}`);
    }
  }
  return {
    name,
    timestamp: new Date().toISOString(),
    source,
    sessionId,
    properties,
  };
}

export function redactPiiFields(event: AnalyticsEvent): AnalyticsEvent {
  const schema = ANALYTICS_EVENT_SCHEMA.find((s) => s.name === event.name);
  if (!schema) return event;

  const redacted = { ...event, properties: { ...event.properties } };
  for (const [key, def] of Object.entries(schema.properties)) {
    if (def.pii && redacted.properties[key]) {
      redacted.properties[key] = "[REDACTED]";
    }
  }
  return redacted;
}

export function filterByPrivacyTier(events: AnalyticsEvent[], maxTier: PrivacyTier): AnalyticsEvent[] {
  const tierOrder: PrivacyTier[] = ["public", "internal", "pii", "financial"];
  const maxIndex = tierOrder.indexOf(maxTier);

  return events.filter((event) => {
    const schema = ANALYTICS_EVENT_SCHEMA.find((s) => s.name === event.name);
    if (!schema) return false;
    return tierOrder.indexOf(schema.privacyTier) <= maxIndex;
  });
}
