export type PrivacyTier = "public" | "internal" | "pii" | "financial";

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
