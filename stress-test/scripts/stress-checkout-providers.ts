#!/usr/bin/env node
/**
 * Stress-tests checkout against every payment provider registered for the region:
 * creates a cart, adds a line, sets addresses, adds shipping, initiates payment.
 *
 * - Hosted PSPs (Xendit, PayPal, Stripe): records session data and
 *   hosted URL when present (approval_url for PayPal, client_secret for Stripe).
 * - COD (pp_cod_cod): completes the cart (Medusa `complete-cart` workflow runs
 *   `authorizePaymentSession` internally; no separate Store `/authorize` call).
 *
 * Prerequisites: Medusa running, root .env.local with NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
 * NEXT_PUBLIC_MEDUSA_REGION_ID (or MEDUSA_REGION_ID), MEDUSA_BACKEND_URL or
 * NEXT_PUBLIC_MEDUSA_URL, sandbox keys for each provider you expect to load.
 *
 * Optional: MEDUSA_SECRET_API_KEY for Admin API verification (order list).
 * Optional: DATABASE_URL + --with-db to SELECT recent orders via pg (from apps/medusa).
 * Optional: STRESS_CHECKOUT_VARIANT_ID=variant_... to pin the catalog variant (e.g. from admin).
 * Optional: STRESS_CHECKOUT_PRODUCT_ID=prod_... + MEDUSA_SECRET_API_KEY resolves first variant when store list is empty.
 * Pinned prod_/variant_ ids: script can publish draft + link MEDUSA_SALES_CHANNEL_ID unless STRESS_CHECKOUT_NO_PREPARE=1.
 * Or set STRESS_CHECKOUT_PUBLISH_DRAFT / STRESS_CHECKOUT_LINK_SALES_CHANNEL explicitly (overrides auto when NO_PREPARE unset).
 *
 * Usage:
 *   node --import tsx/esm stress-test/scripts/stress-checkout-providers.ts
 *   node --import tsx/esm stress-test/scripts/stress-checkout-providers.ts --providers=cod,xendit
 *   node --import tsx/esm stress-test/scripts/stress-checkout-providers.ts --mandatory-core
 *   node --import tsx/esm stress-test/scripts/stress-checkout-providers.ts --no-cod-complete
 *   node --import tsx/esm stress-test/scripts/stress-checkout-providers.ts --with-db
 */
import { createRequire } from "module";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { attach } from "./lib/runtime-log-tee.mjs";

import {
  pickPaymentSessionForProvider,
  resolveCheckoutAction,
} from "../../apps/storefront/src/lib/medusa-checkout-action.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
attach(import.meta.url);
const root = path.resolve(__dirname, "../..");

const require = createRequire(import.meta.url);
try {
  const dotenv = require("dotenv") as {
    config: (_o?: { path?: string; override?: boolean }) => void;
  };
  dotenv.config({ path: path.join(root, ".env.local"), override: true });
} catch {
  /* optional */
}

function resolveSdk() {
  const candidates = [
    path.join(root, "apps/storefront/node_modules/@medusajs/js-sdk"),
    path.join(root, "node_modules/@medusajs/js-sdk"),
  ];
  for (const c of candidates) {
    try {
      return require(c).default;
    } catch {
      /* next */
    }
  }
  throw new Error(
    "Could not load @medusajs/js-sdk. Run: pnpm install (from repo root).",
  );
}

const Medusa = resolveSdk();

/** Must match `PAYMENT_PROVIDER_IDS` in `apps/storefront/src/lib/medusa-checkout.ts`. */
const MANDATORY_PROVIDER_IDS = [
  "pp_cod_cod",
  "pp_stripe_stripe",
  "pp_paypal_paypal",
  "pp_xendit_xendit",
] as const;

function stripSlash(u) {
  return u.replace(/\/$/, "");
}

function medusaBaseUrl() {
  const u =
    process.env.MEDUSA_BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_MEDUSA_URL?.trim() ||
    "";
  return stripSlash(u || "http://localhost:9000");
}

function publishableKey() {
  return (
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY?.trim() ||
    process.env.MEDUSA_PUBLISHABLE_API_KEY?.trim() ||
    ""
  );
}

function regionId() {
  return (
    process.env.NEXT_PUBLIC_MEDUSA_REGION_ID?.trim() ||
    process.env.MEDUSA_REGION_ID?.trim() ||
    ""
  );
}

function salesChannelMerge(body) {
  const sc =
    process.env.MEDUSA_SALES_CHANNEL_ID?.trim() ||
    process.env.NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID?.trim();
  if (sc) return { ...body, sales_channel_id: sc };
  return body;
}

function secretApiKeyBasicAuthorization(secret) {
  const payload = `${secret}:`;
  const b64 = Buffer.from(payload, "utf8").toString("base64");
  return `Basic ${b64}`;
}

function parseArgs(argv) {
  const out = {
    providers: /** @type {string[] | null} */ null,
    codComplete: true,
    cleanup: true,
    withDb: false,
    mandatoryCore: false,
  };
  for (const a of argv) {
    if (a.startsWith("--providers=")) {
      out.providers = a
        .slice("--providers=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === "--no-cod-complete") {
      out.codComplete = false;
    } else if (a === "--no-cleanup") {
      out.cleanup = false;
    } else if (a === "--with-db") {
      out.withDb = true;
    } else if (a === "--mandatory-core") {
      out.mandatoryCore = true;
    }
  }
  return out;
}

/** Surfaces Medusa client / fetch rejection details when the message is generic. */
function formatStressError(e) {
  if (e instanceof Error) {
    const any =
      /** @type {{ cause?: unknown; response?: { data?: unknown } }} */ e;
    const cause = any.cause;
    if (
      cause instanceof Error &&
      cause.message &&
      cause.message !== e.message
    ) {
      return `${e.message} (${cause.message})`;
    }
    const data = any.response?.data;
    if (data && typeof data === "object" && data !== null) {
      const msg = /** @type {{ message?: string }} */ data.message;
      if (typeof msg === "string" && msg.trim()) {
        return `${e.message}: ${msg}`;
      }
      try {
        const s = JSON.stringify(data);
        if (s && s !== "{}" && s.length < 800) return `${e.message} ${s}`;
      } catch {
        /* ignore */
      }
    }
    const msg = e.message.trim();
    if (
      msg === "An unknown error occurred." ||
      msg === "An unknown error occurred"
    ) {
      const extra = /** @type {Record<string, unknown>} */ e;
      const status =
        typeof extra.status === "number"
          ? extra.status
          : typeof extra.statusCode === "number"
            ? extra.statusCode
            : undefined;
      const body =
        extra.body ?? extra.response ?? extra.toJSON?.() ?? undefined;
      const bits = [
        typeof status === "number" ? `status=${status}` : null,
        body !== undefined
          ? `detail=${JSON.stringify(body).slice(0, 600)}`
          : null,
      ].filter(Boolean);
      if (bits.length) return `${msg} ${bits.join(" ")}`;
    }
    return e.message;
  }
  return String(e);
}

function hostedUrlFromSessionData(data) {
  if (!data || typeof data !== "object") return null;
  const d = /** @type {Record<string, unknown>} */ data;
  if (typeof d.checkout_url === "string" && d.checkout_url.startsWith("http"))
    return d.checkout_url;
  if (typeof d.approval_url === "string" && d.approval_url.startsWith("http"))
    return d.approval_url;
  return null;
}

function summarizeSessionData(data) {
  if (!data || typeof data !== "object") return {};
  const d = /** @type {Record<string, unknown>} */ data;
  const keys = Object.keys(d).filter((k) => {
    const v = d[k];
    if (typeof v === "string" && v.length > 80) return false;
    return true;
  });
  const o = {};
  for (const k of keys) {
    const v = d[k];
    if (k === "client_secret" && typeof v === "string") {
      o.has_client_secret = true;
      continue;
    }
    if (
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    ) {
      o[k] = v;
    }
  }
  return o;
}

async function tryDeleteCart(baseUrl, publishableKey, cartId) {
  const url = `${baseUrl}/store/carts/${encodeURIComponent(cartId)}`;
  try {
    await fetch(url, {
      method: "DELETE",
      headers: { "x-publishable-api-key": publishableKey },
    });
  } catch {
    /* best-effort */
  }
}

async function adminListOrders(baseUrl, secret, limit = 8) {
  const url = `${baseUrl}/admin/orders?limit=${limit}&order=-created_at`;
  const res = await fetch(url, {
    headers: { Authorization: secretApiKeyBasicAuthorization(secret) },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Admin orders ${res.status}: ${t.slice(0, 400)}`);
  }
  return res.json();
}

async function queryRecentOrdersPg() {
  const pgPath = path.join(root, "apps/medusa/node_modules/pg");
  let Client;
  try {
    ({ Client } = require(pgPath));
  } catch {
    throw new Error("Could not load pg from apps/medusa/node_modules/pg");
  }
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const r = await client.query(
      `SELECT id, display_id, status, email, created_at
       FROM "order"
       ORDER BY created_at DESC
       LIMIT 12`,
    );
    return r.rows;
  } finally {
    await client.end().catch(() => {});
  }
}

/** Same shape as storefront `catalog-fetch` so variants resolve with the publishable key + sales channel. */
const PRODUCT_LIST_FIELDS =
  "*variants,*variants.calculated_price,*variants.options,*variants.barcode,*categories,*options,+thumbnail,*images,+metadata,+created_at";

function secretKey() {
  return (
    process.env.MEDUSA_SECRET_API_KEY?.trim() ||
    process.env.MEDUSA_ADMIN_API_SECRET?.trim() ||
    ""
  );
}

function envBool(name) {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function envSalesChannelId() {
  return (
    process.env.MEDUSA_SALES_CHANNEL_ID?.trim() ||
    process.env.NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID?.trim() ||
    ""
  );
}

/** When false, pinned STRESS_CHECKOUT_* can auto-publish draft and link sales channel for store API. */
function stressAutoPrepareCatalog() {
  return !envBool("STRESS_CHECKOUT_NO_PREPARE");
}

async function adminPostProductUpdate(baseUrl, secret, productId, body) {
  const url = `${baseUrl}/admin/products/${encodeURIComponent(productId)}`;
  const headers = {
    Authorization: secretApiKeyBasicAuthorization(secret),
    "Content-Type": "application/json",
  };
  let res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (res.status === 405) {
    res = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
  }
  return res;
}

async function fetchAdminProductFull(baseUrl, secret, productId) {
  const fields = encodeURIComponent("id,status,*variants,*sales_channels");
  const res = await fetch(
    `${baseUrl}/admin/products/${encodeURIComponent(productId)}?fields=${fields}`,
    { headers: { Authorization: secretApiKeyBasicAuthorization(secret) } },
  );
  if (!res.ok) return null;
  const j = await res.json();
  return j.product ?? null;
}

function firstVariantIdFromProduct(product) {
  const variants = product?.variants;
  if (!Array.isArray(variants)) return null;
  for (const v of variants) {
    if (typeof v?.id === "string" && v.id.startsWith("variant_")) {
      return v.id;
    }
  }
  return null;
}

function salesChannelIdsFromProduct(product) {
  const sc = product?.sales_channels;
  if (!Array.isArray(sc)) return [];
  return sc.map((x) => x?.id).filter((id) => typeof id === "string");
}

/**
 * Store carts only accept variants for products that are published and in the cart sales channel.
 * When autoPrepare is true (pinned prod_/variant_ stress ids), default is to fix draft + missing channel unless NO_PREPARE.
 */
async function ensureProductSellableForStore(baseUrl, secret, productId, opts) {
  const autoPrepare = Boolean(opts?.autoPrepare);
  const auto = autoPrepare && stressAutoPrepareCatalog();
  const publishDraft = envBool("STRESS_CHECKOUT_PUBLISH_DRAFT") || auto;
  const linkChannel = envBool("STRESS_CHECKOUT_LINK_SALES_CHANNEL") || auto;

  const product = await fetchAdminProductFull(baseUrl, secret, productId);
  if (!product) {
    throw new Error(
      `Admin GET product ${productId} failed (check MEDUSA_SECRET_API_KEY).`,
    );
  }
  const variantId = firstVariantIdFromProduct(product);
  if (!variantId) {
    throw new Error(`Product ${productId} has no variants.`);
  }

  const payload = {};
  const status = String(product.status ?? "");
  if (status !== "published") {
    if (!publishDraft) {
      throw new Error(
        `Product ${productId} is ${status}. Store checkout needs a published product. Publish in admin catalog, or set STRESS_CHECKOUT_PUBLISH_DRAFT=1, or use pinned STRESS_CHECKOUT_PRODUCT_ID without STRESS_CHECKOUT_NO_PREPARE=1.`,
      );
    }
    payload.status = "published";
  }

  const requiredSc = envSalesChannelId();
  const existingSc = salesChannelIdsFromProduct(product);
  if (requiredSc && !existingSc.includes(requiredSc)) {
    if (!linkChannel) {
      throw new Error(
        `Product ${productId} is not linked to sales channel ${requiredSc}. Link it in Medusa Admin, or set STRESS_CHECKOUT_LINK_SALES_CHANNEL=1, or use pinned id without STRESS_CHECKOUT_NO_PREPARE=1.`,
      );
    }
    const merged = [...new Set([...existingSc, requiredSc])];
    payload.sales_channels = merged.map((id) => ({ id }));
  }

  if (Object.keys(payload).length > 0) {
    const res = await adminPostProductUpdate(
      baseUrl,
      secret,
      productId,
      payload,
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(
        `Admin update product ${productId}: ${res.status} ${t.slice(0, 400)}`,
      );
    }
    const action = [];
    if (payload.status) action.push("published");
    if (payload.sales_channels) action.push("linked sales channel");
    console.log(`[stress-checkout] ${productId}: ${action.join(", ")}`);
  }

  return variantId;
}

async function getProductIdForVariantAdmin(baseUrl, secret, variantId) {
  const fields = encodeURIComponent("id,product_id,*product");
  const query = new URLSearchParams({
    id: variantId,
    limit: "1",
    fields,
  });
  const res = await fetch(
    `${baseUrl}/admin/product-variants?${query.toString()}`,
    { headers: { Authorization: secretApiKeyBasicAuthorization(secret) } },
  );
  if (!res.ok) return null;
  const j = await res.json();
  const v = Array.isArray(j.variants) ? j.variants[0] : null;
  const pid =
    (typeof v?.product_id === "string" ? v.product_id : null) ??
    (v?.product && typeof v.product.id === "string" ? v.product.id : null);
  return typeof pid === "string" && pid.startsWith("prod_") ? pid : null;
}

async function getFirstVariantIdFromStore(sdk, regionId) {
  const { products } = await sdk.store.product.list(
    salesChannelMerge({
      limit: 10,
      region_id: regionId,
      fields: PRODUCT_LIST_FIELDS,
    }),
  );
  const p = products?.[0];
  const v = p?.variants?.[0];
  const id = v?.id;
  if (typeof id === "string" && id.startsWith("variant_")) return id;
  return null;
}

/** When sales channel env is wrong, retry without filtering (still scoped by region). */
async function getFirstVariantIdFromStoreLoose(sdk, regionId) {
  const { products } = await sdk.store.product.list({
    limit: 10,
    region_id: regionId,
    fields: PRODUCT_LIST_FIELDS,
  });
  const p = products?.[0];
  const v = p?.variants?.[0];
  const id = v?.id;
  if (typeof id === "string" && id.startsWith("variant_")) return id;
  return null;
}

/** Store API only sees published catalog rows; admin list may include drafts. */
async function getFirstVariantIdFromAdmin(baseUrl, secret) {
  const qs = new URLSearchParams();
  qs.set("limit", "40");
  qs.set("fields", "id,status,*variants");
  const res = await fetch(`${baseUrl}/admin/products?${qs.toString()}`, {
    headers: { Authorization: secretApiKeyBasicAuthorization(secret) },
  });
  if (!res.ok) return null;
  const j = await res.json();
  for (const p of j.products ?? []) {
    if (String(p.status ?? "") !== "published") continue;
    const variants = p.variants;
    if (!Array.isArray(variants)) continue;
    for (const v of variants) {
      const id = v?.id;
      if (typeof id === "string" && id.startsWith("variant_")) return id;
    }
  }
  return null;
}

async function resolveStressVariantId(sdk, regionId, baseUrl) {
  const secret = secretKey();

  const variantEnv = process.env.STRESS_CHECKOUT_VARIANT_ID?.trim();
  if (variantEnv && variantEnv.startsWith("variant_")) {
    console.log(`Using STRESS_CHECKOUT_VARIANT_ID=${variantEnv}`);
    if (secret) {
      const pid = await getProductIdForVariantAdmin(
        baseUrl,
        secret,
        variantEnv,
      );
      if (pid) {
        await ensureProductSellableForStore(baseUrl, secret, pid, {
          autoPrepare: true,
        });
      } else {
        console.warn(
          "[stress-checkout] Could not load product_id for this variant; skipped publish/sales-channel check.",
        );
      }
    }
    return variantEnv;
  }

  const productEnv = process.env.STRESS_CHECKOUT_PRODUCT_ID?.trim();
  if (productEnv && productEnv.startsWith("prod_")) {
    if (!secret) {
      console.warn(
        "STRESS_CHECKOUT_PRODUCT_ID needs MEDUSA_SECRET_API_KEY so the script can match Medusa store rules (published + sales channel).",
      );
    } else {
      const vid = await ensureProductSellableForStore(
        baseUrl,
        secret,
        productEnv,
        { autoPrepare: true },
      );
      console.log(
        `Using variant from STRESS_CHECKOUT_PRODUCT_ID=${productEnv} -> ${vid}`,
      );
      return vid;
    }
  }

  let fromStore = await getFirstVariantIdFromStore(sdk, regionId);
  if (fromStore) return fromStore;

  fromStore = await getFirstVariantIdFromStoreLoose(sdk, regionId);
  if (fromStore) {
    console.log(
      "Resolved variant from store without sales_channel_id (check MEDUSA_SALES_CHANNEL_ID if cart/checkout misbehaves).",
    );
    return fromStore;
  }

  if (secret) {
    const fromAdmin = await getFirstVariantIdFromAdmin(baseUrl, secret);
    if (fromAdmin) {
      console.log(
        `Resolved variant via Admin API (published products only; store list was empty): ${fromAdmin}`,
      );
      return fromAdmin;
    }
  }

  throw new Error(
    "No product variant found. Publish a product in your sales channel, or set STRESS_CHECKOUT_PRODUCT_ID + MEDUSA_SECRET_API_KEY (draft is auto-published unless STRESS_CHECKOUT_NO_PREPARE=1), or run `pnpm e2e:prep:medusa`. Check region and sales channel env.",
  );
}

async function buildPreparedCart(sdk, regionId, variantId, email) {
  const { cart: created } = await sdk.store.cart.create(
    salesChannelMerge({ region_id: regionId }),
  );
  const cartId = created?.id;
  if (!cartId) throw new Error("Cart create did not return id");

  await sdk.store.cart.createLineItem(cartId, {
    variant_id: variantId,
    quantity: 1,
  });

  await sdk.store.cart.update(cartId, {
    email: email || process.env.CHECKOUT_TEST_EMAIL || "delivered@resend.dev",
    shipping_address: {
      first_name: "Stress",
      last_name: "Checkout",
      address_1: "1 Test Street",
      city: "Manila",
      country_code: "ph",
      postal_code: "1000",
      province: "NCR",
    },
    billing_address: {
      first_name: "Stress",
      last_name: "Checkout",
      address_1: "1 Test Street",
      city: "Manila",
      country_code: "ph",
      postal_code: "1000",
      province: "NCR",
    },
  });

  const { shipping_options } = await sdk.store.fulfillment.listCartOptions({
    cart_id: cartId,
  });
  const first = shipping_options?.[0];
  if (!first?.id) {
    throw new Error("No shipping options for cart (region / PH seed).");
  }
  await sdk.store.cart.addShippingMethod(cartId, { option_id: first.id });

  return cartId;
}

async function initiateForProvider(sdk, cartId, providerId) {
  const { cart: refreshedForPayment } = await sdk.store.cart.retrieve(cartId, {
    fields: "+payment_collection,*payment_collection.payment_sessions",
  });
  await sdk.store.payment.initiatePaymentSession(refreshedForPayment, {
    provider_id: providerId,
    data: {
      idempotency_key: cartId,
    },
  });
  const { cart: after } = await sdk.store.cart.retrieve(cartId, {
    fields: "+payment_collection,*payment_collection.payment_sessions",
  });
  const pc = after.payment_collection;
  const sessions = pc?.payment_sessions ?? [];
  const session = pickPaymentSessionForProvider(sessions, providerId);
  if (!session) {
    const found = sessions.map((s) => s.provider_id).join(", ") || "(none)";
    throw new Error(
      `No payment session for provider ${providerId}. Found: ${found}.`,
    );
  }
  return {
    payment_collection_id: pc?.id,
    session,
  };
}

async function listPaymentProviders(sdk, baseUrl, pub, regionId) {
  if (typeof sdk.store.payment?.listPaymentProviders === "function") {
    const r = await sdk.store.payment.listPaymentProviders({
      region_id: regionId,
    });
    return r.payment_providers ?? [];
  }
  const res = await fetch(
    `${baseUrl}/store/payment-providers?region_id=${encodeURIComponent(regionId)}`,
    { headers: { "x-publishable-api-key": pub } },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`list payment providers ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  return j.payment_providers ?? [];
}

async function completeCart(sdk, cartId) {
  return sdk.store.cart.complete(cartId);
}

function providerMatchesFilter(providerId, wanted) {
  if (!wanted || wanted.length === 0) return true;
  const lower = providerId.toLowerCase();
  return wanted.some((w) => {
    const x = w.toLowerCase().replace(/^pp_/, "");
    return (
      lower.includes(x) ||
      lower.endsWith(`_${x}`) ||
      (x === "stripe" && lower.includes("stripe")) ||
      (x === "paypal" && lower.includes("paypal")) ||
      (x === "cod" && lower.includes("cod")) ||
      (x === "xendit" && lower.includes("xendit"))
    );
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = medusaBaseUrl();
  const pub = publishableKey();
  const reg = regionId();
  if (!pub || !reg) {
    console.error(
      "Set NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY and NEXT_PUBLIC_MEDUSA_REGION_ID (or MEDUSA_REGION_ID) in .env.local",
    );
    process.exit(1);
  }

  const sdk = new Medusa({ baseUrl, publishableKey: pub });
  const logDir = path.join(root, "stress-test/checkout-provider-stress-logs");
  await fs.mkdir(logDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(logDir, `run-${stamp}.jsonl`);

  const variantId = await resolveStressVariantId(sdk, reg, baseUrl);

  const payment_providers = await listPaymentProviders(sdk, baseUrl, pub, reg);
  const enabledIds = new Set(
    (payment_providers ?? []).map((p) => p.id).filter(Boolean),
  );

  /** @type {Array<Record<string, unknown>>} */
  const results = [];

  if (args.mandatoryFive) {
    for (const mid of MANDATORY_PROVIDER_IDS) {
      if (!enabledIds.has(mid)) {
        const failRow = {
          t: new Date().toISOString(),
          provider_id: mid,
          ok: false,
          cart_id: null,
          error: "NOT_ENABLED_OR_NOT_VISIBLE_FOR_REGION",
          hosted_url: null,
          session_summary: null,
          order_id: null,
          complete_type: null,
          action_kind: null,
          mandatory_matrix: true,
        };
        results.push(failRow);
        console.log(JSON.stringify(failRow));
        await fs.appendFile(reportPath, JSON.stringify(failRow) + "\n", "utf8");
      }
    }
  }

  let providers = (payment_providers ?? []).filter((p) =>
    args.providers?.length ? providerMatchesFilter(p.id, args.providers) : true,
  );

  if (args.mandatoryCore) {
    providers = MANDATORY_PROVIDER_IDS.filter((id) => enabledIds.has(id)).map(
      (id) => ({ id }),
    );
  }

  if (providers.length === 0 && !args.mandatoryCore) {
    console.error(
      "No payment providers match. Check region payment providers in Admin and --providers filter.",
    );
    process.exit(1);
  }

  console.log(`Medusa: ${baseUrl}`);
  console.log(`Region: ${reg}`);
  console.log(
    `Providers to run (${providers.length}): ${providers.map((p) => p.id).join(", ")}`,
  );
  if (args.mandatoryCore) {
    console.log(
      "Mode: --mandatory-core (all configured PSP ids must be region-enabled; missing providers are recorded as failures).",
    );
  }

  const secret =
    process.env.MEDUSA_SECRET_API_KEY?.trim() ||
    process.env.MEDUSA_ADMIN_API_SECRET?.trim() ||
    "";

  for (const pp of providers) {
    const providerId = pp.id;
    const row = {
      provider_id: providerId,
      ok: false,
      cart_id: null,
      error: null,
      hosted_url: null,
      session_summary: null,
      order_id: null,
      complete_type: null,
      action_kind: null,
      payment_session_id: null,
      resolve_ok: null,
    };

    let cartId;
    try {
      cartId = await buildPreparedCart(
        sdk,
        reg,
        variantId,
        process.env.CHECKOUT_TEST_EMAIL || "delivered@resend.dev",
      );
      row.cart_id = cartId;

      const { payment_collection_id, session } = await initiateForProvider(
        sdk,
        cartId,
        providerId,
      );
      row.payment_session_id =
        typeof session?.id === "string" ? session.id : null;
      const data = session?.data;
      const action = resolveCheckoutAction(providerId, session);
      row.action_kind = action.kind;
      if (action.kind === "error") {
        throw new Error(action.message);
      }
      row.resolve_ok = true;
      row.hosted_url = hostedUrlFromSessionData(data);
      row.session_summary = summarizeSessionData(data);
      row.ok = true;

      const isCod =
        providerId.includes("pp_cod_") || providerId.includes("_cod_");

      if (isCod && args.codComplete) {
        if (!payment_collection_id || !session?.id) {
          throw new Error("COD: missing payment_collection or session id");
        }
        const completed = await completeCart(sdk, cartId);
        const payload = completed?.data ?? completed;
        if (payload?.type === "order" && payload.order?.id) {
          row.order_id = payload.order.id;
          row.complete_type = "order";
        } else if (payload?.type === "cart") {
          row.error = JSON.stringify(payload.error ?? payload.cart ?? {});
          row.ok = false;
        } else {
          row.complete_type = payload?.type ?? "unknown";
        }
      } else if (!isCod && args.cleanup) {
        await tryDeleteCart(baseUrl, pub, cartId);
      }
    } catch (e) {
      row.ok = false;
      row.error = formatStressError(e);
      if (cartId && args.cleanup) {
        await tryDeleteCart(baseUrl, pub, cartId);
      }
    }

    results.push(row);
    const line = JSON.stringify({ t: new Date().toISOString(), ...row });
    await fs.appendFile(reportPath, line + "\n", "utf8");
    console.log(line);
  }

  if (secret) {
    try {
      const ordersJson = await adminListOrders(baseUrl, secret, 10);
      const orders = ordersJson?.orders ?? [];
      console.log(
        "\nAdmin API: recent orders (sample):",
        orders.map((o) => ({
          id: o.id,
          display_id: o.display_id,
          status: o.status,
        })),
      );
      await fs.appendFile(
        reportPath,
        JSON.stringify({
          t: new Date().toISOString(),
          admin_orders_sample: orders.map((o) => ({
            id: o.id,
            display_id: o.display_id,
            status: o.status,
          })),
        }) + "\n",
        "utf8",
      );
    } catch (e) {
      console.warn(
        "Admin API order list skipped:",
        e instanceof Error ? e.message : e,
      );
    }
  } else {
    console.warn(
      "Set MEDUSA_SECRET_API_KEY to verify orders via Admin API after the run.",
    );
  }

  if (args.withDb && process.env.DATABASE_URL?.trim()) {
    try {
      const rows = await queryRecentOrdersPg();
      console.log("\nDATABASE_URL: recent order rows:", rows);
      await fs.appendFile(
        reportPath,
        JSON.stringify({
          t: new Date().toISOString(),
          db_orders: rows,
        }) + "\n",
        "utf8",
      );
    } catch (e) {
      console.warn("DB query skipped:", e instanceof Error ? e.message : e);
    }
  }

  console.log(`\nReport: ${reportPath}`);

  const failed = results.filter((r) => !r.ok).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
