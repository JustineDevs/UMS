/**
 * Read-only Medusa discovery for checkout payment matrix (regions, store-visible PSPs,
 * purchasable variant probe, shipping options). Exits 0 when prerequisites exist.
 *
 * Run: node --import tsx/esm stress-test/scripts/preflight-checkout-payment-matrix.ts
 *
 * Env: same as stress-checkout-providers (NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY, region id, MEDUSA URL).
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { attach } from "./lib/runtime-log-tee.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
attach(import.meta.url);
const root = path.resolve(__dirname, "../..");

const require = createRequire(import.meta.url);
try {
  const dotenv = require("dotenv") as { config: (o?: { path?: string; override?: boolean }) => void };
  dotenv.config({ path: path.join(root, ".env") });
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
  throw new Error("Could not load @medusajs/js-sdk.");
}

const Medusa = resolveSdk();

function stripSlash(u: string) {
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

function regionIdEnv() {
  return (
    process.env.NEXT_PUBLIC_MEDUSA_REGION_ID?.trim() ||
    process.env.MEDUSA_REGION_ID?.trim() ||
    ""
  );
}

function salesChannelMerge(body: Record<string, unknown>) {
  const sc =
    process.env.MEDUSA_SALES_CHANNEL_ID?.trim() ||
    process.env.NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID?.trim();
  if (sc) return { ...body, sales_channel_id: sc };
  return body;
}

const MANDATORY_IDS = [
  "pp_cod_cod",
  "pp_stripe_stripe",
  "pp_paypal_paypal",
  "pp_paymongo_paymongo",
  "pp_maya_maya",
] as const;

/** Provider ids this codebase registers in `apps/medusa/medusa-config.ts` plus Medusa default. */
const KNOWN_REGISTERED_IDS = new Set<string>([
  ...MANDATORY_IDS,
  "pp_system_default",
]);

async function main() {
  const baseUrl = medusaBaseUrl();
  const pub = publishableKey();
  const reg = regionIdEnv();
  if (!pub || !reg) {
    console.error(
      JSON.stringify({
        ok: false,
        error: "missing_publishable_or_region",
        message:
          "Set NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY and NEXT_PUBLIC_MEDUSA_REGION_ID",
      }),
    );
    process.exit(1);
  }

  const sdk = new Medusa({ baseUrl, publishableKey: pub });

  let paymentProviders: { id?: string }[] = [];
  if (typeof sdk.store.payment?.listPaymentProviders === "function") {
    const r = await sdk.store.payment.listPaymentProviders({
      region_id: reg,
    });
    paymentProviders = r.payment_providers ?? [];
  } else {
    const res = await fetch(
      `${baseUrl}/store/payment-providers?region_id=${encodeURIComponent(reg)}`,
      { headers: { "x-publishable-api-key": pub } },
    );
    if (!res.ok) {
      console.error(
        JSON.stringify({
          ok: false,
          error: "list_payment_providers_failed",
          status: res.status,
        }),
      );
      process.exit(1);
    }
    const j = (await res.json()) as { payment_providers?: { id?: string }[] };
    paymentProviders = j.payment_providers ?? [];
  }

  const enabled = new Set(
    paymentProviders.map((p) => p.id).filter((id): id is string => Boolean(id)),
  );

  const { products } = await sdk.store.product.list(
    salesChannelMerge({
      limit: 5,
      region_id: reg,
      fields: "*variants",
    }) as never,
  );
  const firstVariant = products?.[0]?.variants?.[0]?.id;
  const variantOk =
    typeof firstVariant === "string" && firstVariant.startsWith("variant_");

  let shippingOk = false;
  if (variantOk) {
    const { cart: created } = await sdk.store.cart.create(
      salesChannelMerge({ region_id: reg }) as never,
    );
    const cartId = created?.id;
    if (cartId) {
      await sdk.store.cart.createLineItem(cartId, {
        variant_id: firstVariant,
        quantity: 1,
      });
      const { shipping_options } = await sdk.store.fulfillment.listCartOptions({
        cart_id: cartId,
      });
      shippingOk = Boolean(shipping_options?.[0]?.id);
      await fetch(`${baseUrl}/store/carts/${encodeURIComponent(cartId)}`, {
        method: "DELETE",
        headers: { "x-publishable-api-key": pub },
      }).catch(() => {});
    }
  }

  const matrix = MANDATORY_IDS.map((id) => ({
    provider_id: id,
    visible_for_region: enabled.has(id),
  }));

  const regionOnlyLegacyOrUnknown = [...enabled]
    .filter((id) => !KNOWN_REGISTERED_IDS.has(id))
    .sort();

  const out = {
    ok: true,
    medusa_base_url: baseUrl,
    region_id: reg,
    payment_providers_visible: [...enabled].sort(),
    /** Still linked on the region in Medusa DB but not registered in this repo (remove in Admin if unused). */
    region_providers_not_in_repo: regionOnlyLegacyOrUnknown,
    mandatory_matrix: matrix,
    sample_variant_resolvable: variantOk,
    shipping_options_for_probe_cart: shippingOk,
  };

  console.log(JSON.stringify(out, null, 2));

  if (regionOnlyLegacyOrUnknown.length > 0) {
    console.error(
      "\nPreflight note: region lists provider id(s) not registered in this repository. Remove obsolete providers in Medusa Admin (Settings → Regions) if checkout should not offer them:",
      regionOnlyLegacyOrUnknown.join(", "),
    );
  }

  const missingMandatory = matrix.filter((m) => !m.visible_for_region);
  if (missingMandatory.length > 0) {
    console.error(
      `\nPreflight: ${missingMandatory.length} mandatory provider id(s) not visible for this region in the Store API.`,
    );
    process.exit(2);
  }
  if (!variantOk || !shippingOk) {
    console.error(
      "\nPreflight: catalog or shipping probe failed (publish product in sales channel, check region shipping).",
    );
    process.exit(3);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
