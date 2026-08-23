"use client";

import { capturePostHogClientEvent } from "@universal-music-store/sdk";
import { hasAnalyticsConsent } from "@/lib/analytics-consent";

type VaFn = (_action: string, _data?: Record<string, unknown>) => void;
type GtagFn = (..._args: unknown[]) => void;
type FbqFn = (..._args: unknown[]) => void;

function va(): VaFn | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { va?: VaFn }).va;
}

function capturePostHog(event: string, properties?: Record<string, unknown>): void {
  try {
    if (hasAnalyticsConsent()) capturePostHogClientEvent(event, properties);
  } catch {
    // Telemetry must never affect storefront behavior.
  }
}

function fireGtag(...args: unknown[]): void {
  if (typeof window === "undefined") return;
  const g = (window as Window & { gtag?: GtagFn }).gtag;
  if (typeof g === "function") g(...args);
}

function fireFbq(...args: unknown[]): void {
  if (typeof window === "undefined") return;
  const f = (window as Window & { fbq?: FbqFn }).fbq;
  if (typeof f === "function") f(...args);
}

function currencyCode(value: string | undefined): string {
  return value?.trim().toUpperCase() || "PHP";
}

export function trackProductClick(payload: { slug: string; id: string }): void {
  va()?.("event", { name: "product_click", ...payload });
  capturePostHog("product_click", payload);
}

export function trackProductView(payload: { slug: string; id: string }): void {
  va()?.("event", { name: "product_view", ...payload });
  fireGtag("event", "view_item", { item_id: payload.id, item_name: payload.slug });
  capturePostHog("product_view", payload);
}

export function trackAddToCart(payload: {
  slug: string;
  id: string;
  variantId: string;
  price: number;
  quantity: number;
  name: string;
  currencyCode?: string;
}): void {
  const currency = currencyCode(payload.currencyCode);
  va()?.("event", { name: "add_to_cart", slug: payload.slug, variantId: payload.variantId, price: payload.price, quantity: payload.quantity });
  fireGtag("event", "add_to_cart", {
    currency,
    value: payload.price * payload.quantity,
    items: [{ item_id: payload.variantId, item_name: payload.name, price: payload.price, quantity: payload.quantity }],
  });
  fireFbq("track", "AddToCart", { content_ids: [payload.variantId], content_name: payload.name, content_type: "product", value: payload.price, currency });
  capturePostHog("add_to_cart", { ...payload, currencyCode: currency });
}

export function trackBeginCheckout(payload: {
  value: number;
  itemCount: number;
  currencyCode?: string;
}): void {
  const currency = currencyCode(payload.currencyCode);
  va()?.("event", { name: "begin_checkout", value: payload.value, item_count: payload.itemCount, currency });
  fireGtag("event", "begin_checkout", { currency, value: payload.value });
  fireFbq("track", "InitiateCheckout", { value: payload.value, currency, num_items: payload.itemCount });
  capturePostHog("begin_checkout", { ...payload, currencyCode: currency });
}

export function trackPurchase(payload: {
  orderId: string;
  value: number;
  itemCount: number;
  paymentMethod?: string;
  currencyCode?: string;
}): void {
  const currency = currencyCode(payload.currencyCode);
  va()?.("event", { name: "purchase", order_id: payload.orderId, value: payload.value, item_count: payload.itemCount, payment_method: payload.paymentMethod, currency });
  fireGtag("event", "purchase", { transaction_id: payload.orderId, currency, value: payload.value });
  fireFbq("track", "Purchase", { value: payload.value, currency });
  capturePostHog("purchase", { ...payload, currencyCode: currency });
}
