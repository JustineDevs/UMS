import type Medusa from "@medusajs/js-sdk";
import { evaluateWebCheckoutPolicy } from "@universal-music-store/omnichannel-policy";
import {
  getMedusaPublishableKey,
  getMedusaRegionId,
  getMedusaStoreBaseUrl,
  withSalesChannelId,
} from "./storefront-medusa-env";
import { createStorefrontMedusaSdk } from "./medusa-sdk";
import { medusaMinorToMajor } from "./medusa-money";
import { tryDeleteStoreCart } from "./medusa-checkout-errors";
import type { StorefrontStockResult } from "./storefront-inventory-guard";
import { buildCheckoutQuoteFingerprint } from "./checkout-quote-fingerprint";
import type { MedusaCartAddressPayload } from "@/lib/medusa-profile-address";

export type MedusaCheckoutLine = { variantId: string; quantity: number };

export type CodCartPayload = {
  email: string;
  shipping_address: MedusaCartAddressPayload;
  billing_address: MedusaCartAddressPayload;
};

type MedusaShippingOptionPreview = {
  id: string;
  name: string;
  priceMajor: number;
  currencyCode: string;
};

export type MedusaCheckoutTotalsPreview = {
  cartId?: string;
  subtotal: number;
  taxTotal: number;
  shippingTotal: number;
  discountTotal: number;
  total: number;
  currencyCode: string;
  lineSubtotalsByVariantId: Record<string, number>;
  quoteFingerprint: string;
  variantIds: string[];
  productIds: string[];
  shippingMethodIds: string[];
  regionId: string | null;
  shippingOptions: MedusaShippingOptionPreview[];
  appliedShippingOptionId: string | null;
};

type PrepareMedusaCartInput = {
  lines: MedusaCheckoutLine[];
  email?: string;
  loyaltyPointsToRedeem?: number;
  codCartPayload?: CodCartPayload;
  /** When set, must match a `listCartOptions` id for this cart. */
  shippingOptionId?: string;
  signal?: AbortSignal;
};

export type PrepareMedusaCartContext = {
  sdk: Medusa;
  cartId: string;
  baseUrl: string;
  publishableKey: string;
  shippingOptions: MedusaShippingOptionPreview[];
  appliedShippingOptionId: string;
  bindToken?: string;
};

function buildShippingOptionPreviews(
  options: unknown[],
  currencyCode: string,
): MedusaShippingOptionPreview[] {
  const cur = currencyCode.trim();
  return options
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const o = raw as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id.trim() : "";
      if (!id) return null;
      const name = typeof o.name === "string" ? o.name : "Shipping";
      const rawAmt = o.amount ?? o.price ?? 0;
      const minor =
        typeof rawAmt === "bigint"
          ? Number(rawAmt)
          : typeof rawAmt === "number" && Number.isFinite(rawAmt)
            ? rawAmt
            : 0;
      return {
        id,
        name,
        priceMajor: medusaMinorToMajor(minor, cur),
        currencyCode: cur.toUpperCase(),
      };
    })
    .filter((x): x is MedusaShippingOptionPreview => x != null);
}

/**
 * Builds a store cart with lines, optional COD addresses, default shipping, and optional loyalty.
 * Does not start payment. Caller owns the cart until delete or completion.
 */
export async function prepareMedusaStoreCart(
  input: PrepareMedusaCartInput,
  codFlow: boolean,
): Promise<PrepareMedusaCartContext> {
  // Medusa's real cart line insertion below is the authoritative availability
  // check for checkout. The standalone Admin preflight remains available for
  // explicit stock checks without creating throwaway carts.
  const webPolicy = evaluateWebCheckoutPolicy({ stockVerified: true });
  if (!webPolicy.allowed) {
    throw new Error(webPolicy.violations.join("; ") || "Checkout policy denied");
  }

  const baseUrl = getMedusaStoreBaseUrl();
  const publishableKey = getMedusaPublishableKey();
  const regionId = getMedusaRegionId();
  if (!publishableKey || !regionId) {
    throw new Error(
      "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY and NEXT_PUBLIC_MEDUSA_REGION_ID are required.",
    );
  }

  if (codFlow) {
    if (!input.codCartPayload?.email?.trim()) {
      throw new Error(
        "Cash on delivery requires a verified delivery profile. Open your account and complete your address, then try again.",
      );
    }
  }

  const sdk = createStorefrontMedusaSdk({ signal: input.signal });

  let bindToken: string | undefined;
  if (typeof window !== "undefined") {
    const bindResponse = await fetch("/api/cart/bind-token", { credentials: "include" });
    const bindBody = (await bindResponse.json().catch(() => ({}))) as { token?: unknown };
    if (!bindResponse.ok || typeof bindBody.token !== "string") {
      throw new Error("Could not secure the checkout session.");
    }
    bindToken = bindBody.token;
  }

  const { cart: created } = await sdk.store.cart.create(
    withSalesChannelId({
      region_id: regionId,
      ...(bindToken ? { metadata: { uvs_cart_bind_token: bindToken } } : {}),
    }) as Parameters<
      typeof sdk.store.cart.create
    >[0],
  );
  const cartId = created?.id;
  if (!cartId) {
    throw new Error("The store did not return a cart id.");
  }

  for (const line of input.lines) {
    await sdk.store.cart.createLineItem(cartId, {
      variant_id: line.variantId,
      quantity: line.quantity,
    });
  }

  const cartEmail = codFlow
    ? input.codCartPayload!.email.trim()
    : input.email?.trim();
  if (cartEmail) {
    await sdk.store.cart.update(cartId, { email: cartEmail });
  }

  if (codFlow && input.codCartPayload) {
    await sdk.store.cart.update(cartId, {
      shipping_address: input.codCartPayload.shipping_address,
      billing_address: input.codCartPayload.billing_address,
      metadata: {
        payment_provider: "cod",
        cod_payment_status: "pending_collection",
      },
    });
  }

  const { shipping_options } = await sdk.store.fulfillment.listCartOptions({
    cart_id: cartId,
  });
  const currencyCode = String(created.currency_code ?? "PHP");
  const rawOpts = shipping_options ?? [];
  const shippingOptionPreviews = buildShippingOptionPreviews(rawOpts, currencyCode);
  const requested = input.shippingOptionId?.trim();
  const pickId =
    requested && rawOpts.some((o) => (o as { id?: string }).id === requested)
      ? requested
      : (rawOpts[0] as { id?: string } | undefined)?.id;
  if (!pickId?.trim()) {
    throw new Error(
      "No shipping options available for this cart. Check your region and shipping setup.",
    );
  }

  await sdk.store.cart.addShippingMethod(cartId, { option_id: pickId.trim() });

  const loyaltyPts = Math.floor(Number(input.loyaltyPointsToRedeem ?? 0));
  if (loyaltyPts > 0) {
    if (!cartEmail) {
      throw new Error("Email is required on the cart before redeeming loyalty points.");
    }
    const loyaltyRes = await fetch(
      `${baseUrl.replace(/\/$/, "")}/store/carts/${encodeURIComponent(cartId)}/loyalty`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": publishableKey,
        },
        body: JSON.stringify({ points: loyaltyPts }),
      },
    );
    if (!loyaltyRes.ok) {
      const errText = await loyaltyRes.text().catch(() => "");
      throw new Error(
        errText || `Loyalty redemption failed (${loyaltyRes.status}).`,
      );
    }
  }

  return {
    sdk,
    cartId,
    baseUrl,
    publishableKey,
    shippingOptions: shippingOptionPreviews,
    appliedShippingOptionId: pickId.trim(),
    bindToken,
  };
}

/**
 * Stock verification via server API route. The Admin API requires MEDUSA_SECRET_API_KEY
 * which is only available server-side. Browser checkout calls this instead of
 * importing medusaAdminFetch directly.
 */
async function verifyStockServerSide(
  lines: MedusaCheckoutLine[],
): Promise<StorefrontStockResult> {
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/checkout/verify-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      const data = (await res.json()) as StorefrontStockResult;
      return data;
    } catch {
      return { ok: false, message: "Stock verification failed", code: "INVENTORY_CHECK_FAILED" };
    }
  }
  const { assertStorefrontLinesStock } = await import("./storefront-inventory-guard");
  return assertStorefrontLinesStock(lines);
}

function readMinorField(record: Record<string, unknown>, key: string): number {
  const v = record[key];
  if (typeof v === "bigint") return Number(v);
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Medusa cart monetary fields are integers in the smallest currency unit. */
export function readMedusaCartMinorField(
  cart: Record<string, unknown>,
  key: string,
): number {
  return readMinorField(cart, key);
}

/**
 * Returns Medusa's authoritative `total` field converted to major units.
 * Medusa computes the grand total server-side accounting for tax-inclusive
 * pricing, discounts, and shipping. Attempting to re-derive it from component
 * fields (subtotal + shipping + tax) double-counts tax in tax-inclusive
 * regions (e.g. Philippines) where subtotal already includes VAT.
 */
export function reconcileMedusaCartGrandTotalMajor(
  cart: Record<string, unknown>,
  currencyCode: string,
): { totalMajor: number; reconciled: boolean } {
  const cur = currencyCode.trim().toUpperCase();
  const api = medusaMinorToMajor(readMinorField(cart, "total"), cur);
  return { totalMajor: Math.round(api * 1e6) / 1e6, reconciled: false };
}

export function cartToTotalsPreview(cart: unknown): MedusaCheckoutTotalsPreview {
  if (!cart || typeof cart !== "object") {
    throw new Error("Invalid cart response from store.");
  }
  const c = cart as Record<string, unknown>;
  const currencyRaw = String(c.currency_code ?? "PHP");
  const subtotal = medusaMinorToMajor(readMinorField(c, "subtotal"), currencyRaw);
  const taxTotal = medusaMinorToMajor(readMinorField(c, "tax_total"), currencyRaw);
  const shippingTotal = medusaMinorToMajor(
    readMinorField(c, "shipping_total"),
    currencyRaw,
  );
  const discountTotal = medusaMinorToMajor(
    readMinorField(c, "discount_total"),
    currencyRaw,
  );
  const { totalMajor: total } = reconcileMedusaCartGrandTotalMajor(c, currencyRaw);

  const lineSubtotalsByVariantId: Record<string, number> = {};
  const items = Array.isArray(c.items) ? c.items : [];
  const variantIds = new Set<string>();
  const productIds = new Set<string>();
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const it = raw as Record<string, unknown>;
    const variant = it.variant as Record<string, unknown> | undefined;
    const variantId =
      typeof it.variant_id === "string"
        ? it.variant_id
        : typeof variant?.id === "string"
          ? variant.id
          : "";
    if (!variantId) continue;
    variantIds.add(variantId.trim());
    const productId =
      typeof it.product_id === "string"
        ? it.product_id
        : typeof variant?.product_id === "string"
          ? variant.product_id
          : "";
    if (productId.trim()) {
      productIds.add(productId.trim());
    }
    let subMinor = readMinorField(it, "subtotal");
    if (subMinor <= 0) {
      const unit = readMinorField(it, "unit_price");
      const qty =
        typeof it.quantity === "number" && Number.isFinite(it.quantity)
          ? Math.max(1, Math.floor(it.quantity))
          : 1;
      if (unit > 0) subMinor = unit * qty;
    }
    const lineMajor = medusaMinorToMajor(subMinor, currencyRaw);
    lineSubtotalsByVariantId[variantId] =
      (lineSubtotalsByVariantId[variantId] ?? 0) + lineMajor;
  }

  const shippingMethodIds = new Set<string>();
  const shippingMethods = Array.isArray(c.shipping_methods)
    ? c.shipping_methods
    : [];
  for (const raw of shippingMethods) {
    if (!raw || typeof raw !== "object") continue;
    const shippingMethod = raw as Record<string, unknown>;
    const methodId =
      typeof shippingMethod.shipping_option_id === "string"
        ? shippingMethod.shipping_option_id
        : typeof shippingMethod.id === "string"
          ? shippingMethod.id
          : "";
    if (methodId.trim()) {
      shippingMethodIds.add(methodId.trim());
    }
  }

  const regionId =
    typeof c.region_id === "string" && c.region_id.trim()
      ? c.region_id.trim()
      : null;
  const quoteFingerprint = buildCheckoutQuoteFingerprint({
    currencyCode: currencyRaw,
    subtotal,
    taxTotal,
    shippingTotal,
    discountTotal,
    total,
    lineSubtotalsByVariantId,
    variantIds: [...variantIds],
    productIds: [...productIds],
    shippingMethodIds: [...shippingMethodIds],
    regionId,
  });

  const cartId = typeof c.id === "string" && c.id.trim() ? c.id.trim() : undefined;

  return {
    cartId,
    subtotal,
    taxTotal,
    shippingTotal,
    discountTotal,
    total,
    currencyCode: currencyRaw.toUpperCase(),
    lineSubtotalsByVariantId,
    quoteFingerprint,
    variantIds: [...variantIds].sort(),
    productIds: [...productIds].sort(),
    shippingMethodIds: [...shippingMethodIds].sort(),
    regionId,
    shippingOptions: [],
    appliedShippingOptionId: null,
  };
}

/** Same totals as checkout: ephemeral cart is always deleted. */
export async function executeMedusaCheckoutTotalsPreview(input: {
  lines: MedusaCheckoutLine[];
  email?: string;
  loyaltyPointsToRedeem?: number;
  codCartPayload?: CodCartPayload;
  shippingOptionId?: string;
  signal?: AbortSignal;
}): Promise<MedusaCheckoutTotalsPreview> {
  const codFlow = Boolean(input.codCartPayload?.email?.trim());
  const ctx = await prepareMedusaStoreCart(
    {
      lines: input.lines,
      email: codFlow ? undefined : input.email,
      codCartPayload: input.codCartPayload,
      loyaltyPointsToRedeem: input.loyaltyPointsToRedeem,
      shippingOptionId: input.shippingOptionId,
      signal: input.signal,
    },
    codFlow,
  );

  try {
    const { cart } = await ctx.sdk.store.cart.retrieve(ctx.cartId, {
      fields:
        "id,region_id,total,currency_code,subtotal,tax_total,shipping_total,discount_total,*items,*shipping_methods",
    } as never);
    const preview = cartToTotalsPreview(cart);
    return {
      ...preview,
      shippingOptions: ctx.shippingOptions,
      appliedShippingOptionId: ctx.appliedShippingOptionId,
    };
  } finally {
    await tryDeleteStoreCart(ctx.cartId, ctx.baseUrl, ctx.publishableKey);
  }
}

export async function readMedusaCartTotalsPreview(
  cartId: string,
): Promise<MedusaCheckoutTotalsPreview> {
  const sdk = createStorefrontMedusaSdk();
  const { cart } = await sdk.store.cart.retrieve(cartId, {
    fields:
      "id,region_id,total,currency_code,subtotal,tax_total,shipping_total,discount_total,*items,*shipping_methods",
  } as never);
  return cartToTotalsPreview(cart);
}

export async function readVerifiedMedusaCartTotalsPreview(
  cartId: string,
): Promise<MedusaCheckoutTotalsPreview> {
  const sdk = createStorefrontMedusaSdk();
  const { cart } = await sdk.store.cart.retrieve(cartId, {
    fields:
      "id,region_id,total,currency_code,subtotal,tax_total,shipping_total,discount_total,*items,*shipping_methods",
  } as never);
  const preview = cartToTotalsPreview(cart);
  const lines = medusaCartToCheckoutLines(cart);
  if (lines.length === 0) {
    throw new Error("Add at least one line item before checkout.");
  }
  const stock = await verifyStockServerSide(lines);
  if (!stock.ok) {
    throw new Error(stock.message);
  }
  return preview;
}

export function medusaCartToCheckoutLines(cart: unknown): MedusaCheckoutLine[] {
  if (!cart || typeof cart !== "object") return [];
  const items = Array.isArray((cart as { items?: unknown }).items)
    ? (cart as { items: unknown[] }).items
    : [];
  return items
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const item = raw as Record<string, unknown>;
      const variant = item.variant as Record<string, unknown> | undefined;
      const variantId =
        typeof item.variant_id === "string"
          ? item.variant_id.trim()
          : typeof variant?.id === "string"
            ? variant.id.trim()
            : "";
      const quantity =
        typeof item.quantity === "number" && Number.isFinite(item.quantity)
          ? Math.floor(item.quantity)
          : 0;
      return variantId && quantity > 0 ? { variantId, quantity } : null;
    })
    .filter((line): line is MedusaCheckoutLine => line != null);
}
