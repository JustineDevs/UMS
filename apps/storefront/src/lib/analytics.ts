"use client";

import {
  capturePostHogClientEvent,
} from "@universal-music-store/sdk";
import { hasAnalyticsConsent } from "@/lib/analytics-consent";

type VaFn = (_action: string, _data?: Record<string, unknown>) => void;

function va(): VaFn | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { va?: VaFn }).va;
}

function capturePostHog(event: string, properties?: Record<string, unknown>): void {
  try {
    if (!hasAnalyticsConsent()) {
      return;
    }
    capturePostHogClientEvent(event, properties);
  } catch {
    /* ignore telemetry failures */
  }
}

/**
 * Client-safe analytics hooks.
 * Vercel Web Analytics (`window.va`) receives all events.
 * GA4 (`window.gtag`) and Meta Pixel (`window.fbq`) fire when configured.
 */
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
}): void {
  va()?.("event", {
    name: "add_to_cart",
    slug: payload.slug,
    variantId: payload.variantId,
    price: payload.price,
    quantity: payload.quantity,
  });
  fireGtag("event", "add_to_cart", {
    currency: "PHP",
    value: payload.price * payload.quantity,
    items: [{ item_id: payload.variantId, item_name: payload.name, price: payload.price, quantity: payload.quantity }],
  });
  fireFbq("track", "AddToCart", {
    content_ids: [payload.variantId],
    content_name: payload.name,
    content_type: "product",
    value: payload.price,
    currency: "PHP",
  });
  capturePostHog("add_to_cart", payload);
}

export function trackBeginCheckout(payload: {
  value: number;
  itemCount: number;
}): void {
  va()?.("event", { name: "begin_checkout", value: payload.value, item_count: payload.itemCount });
  fireGtag("event", "begin_checkout", { currency: "PHP", value: payload.value });
  fireFbq("track", "InitiateCheckout", { value: payload.value, currency: "PHP", num_items: payload.itemCount });
  capturePostHog("begin_checkout", payload);
}

export function trackPurchase(payload: {
  orderId: string;
  value: number;
  itemCount: number;
  paymentMethod?: string;
}): void {
  va()?.("event", {
    name: "purchase",
    order_id: payload.orderId,
    value: payload.value,
    item_count: payload.itemCount,
    payment_method: payload.paymentMethod,
  });
  fireGtag("event", "purchase", {
    transaction_id: payload.orderId,
    currency: "PHP",
    value: payload.value,
  });
  fireFbq("track", "Purchase", { value: payload.value, currency: "PHP" });
  capturePostHog("purchase", payload);
}

type GtagFn = (..._args: unknown[]) => void;
type FbqFn = (..._args: unknown[]) => void;

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
