import { resolve } from "node:path";
import { defineConfig } from "@medusajs/framework/utils";
import { config as loadDotenv } from "dotenv";
import { validateMedusaProcessEnv } from "./src/loaders/validate-process-env";
import { nangoPaymentProviderConfigured } from "./src/lib/nango-payment-credentials";

const repoRoot = resolve(process.cwd(), "../..");
const preservedNodeEnv = process.env.NODE_ENV;
const envFileName =
  preservedNodeEnv === "production" ? ".env.production" : ".env.local";
// Keep deployment/runtime environment variables authoritative over local dotenv files.
loadDotenv({ path: resolve(repoRoot, envFileName) });
loadDotenv({ path: resolve(process.cwd(), envFileName) });
if (preservedNodeEnv === undefined) {
  delete process.env.NODE_ENV;
} else {
  process.env.NODE_ENV = preservedNodeEnv;
}
validateMedusaProcessEnv();

/** Hosted Stripe Checkout (checkout.sessions) — same provider id `pp_stripe_stripe` as the stock plugin. */
const directSandboxCredentialsAllowed = process.env.NODE_ENV !== "production";
const stripeDirectConfigured =
  directSandboxCredentialsAllowed && Boolean(process.env.STRIPE_API_KEY?.trim());
const stripeManagedByNango =
  !stripeDirectConfigured && nangoPaymentProviderConfigured("stripe");
const stripeProvider = stripeManagedByNango || stripeDirectConfigured
  ? [
      {
        resolve: "./src/modules/stripe-checkout-payment",
        id: "stripe",
        options: {
          apiKey: stripeManagedByNango ? "" : process.env.STRIPE_API_KEY,
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
          successUrl: process.env.STRIPE_CHECKOUT_SUCCESS_URL?.trim(),
          cancelUrl: process.env.STRIPE_CHECKOUT_CANCEL_URL?.trim(),
        },
      },
    ]
  : [];

const codProvider = [
  {
    resolve: "./src/modules/cod-payment",
    id: "cod",
    options: {},
  },
];

const paypalDirectConfigured = Boolean(
  directSandboxCredentialsAllowed &&
    process.env.PAYPAL_CLIENT_ID?.trim() &&
    process.env.PAYPAL_CLIENT_SECRET?.trim(),
);
const paypalManagedByNango =
  !paypalDirectConfigured && nangoPaymentProviderConfigured(["paypal", "paypal-sandbox"]);
const paypalProvider =
  paypalManagedByNango || paypalDirectConfigured
    ? [
        {
          resolve: "./src/modules/paypal-payment",
          id: "paypal",
          options: {
            clientId: paypalManagedByNango ? "" : process.env.PAYPAL_CLIENT_ID,
            clientSecret: paypalManagedByNango ? "" : process.env.PAYPAL_CLIENT_SECRET,
            sandbox:
              process.env.PAYPAL_ENVIRONMENT === "sandbox" ||
              nangoPaymentProviderConfigured("paypal-sandbox") ||
              process.env.NODE_ENV !== "production",
          },
        },
      ]
    : [];

// Direct Xendit credentials are valid for hosted production deployments too;
// sandbox-vs-live selection belongs to the credential set, not this gate.
const xenditDirectConfigured =
  Boolean(process.env.XENDIT_SECRET_KEY?.trim()) &&
  Boolean(process.env.XENDIT_WEBHOOK_TOKEN?.trim());
const xenditManagedByNango =
  !xenditDirectConfigured && nangoPaymentProviderConfigured(["xendit", "xendit-sandbox"]);
const xenditProvider =
  xenditDirectConfigured || xenditManagedByNango
    ? [
        {
          resolve: "./src/modules/xendit-payment",
          id: "xendit",
          options: {
            secretKey: xenditManagedByNango ? "" : process.env.XENDIT_SECRET_KEY,
            webhookToken: xenditManagedByNango ? "" : process.env.XENDIT_WEBHOOK_TOKEN,
            successUrl: process.env.XENDIT_CHECKOUT_SUCCESS_URL?.trim(),
            cancelUrl: process.env.XENDIT_CHECKOUT_CANCEL_URL?.trim(),
          },
        },
      ]
    : [];

const paymentProviders = [
  ...stripeProvider,
  ...codProvider,
  ...paypalProvider,
  ...xenditProvider,
];

if (stripeProvider.length === 0 && process.env.NODE_ENV === "production") {
  console.warn(
    "[medusa-config] Stripe provider is not registered (Nango integration is not configured). " +
      "Regions that list pp_stripe_stripe will fail when creating payment sessions. " +
    "Configure the Nango Stripe integration (and STRIPE_WEBHOOK_SECRET in production), " +
      "or remove Stripe from the region in Medusa Admin → Settings → Regions.",
  );
}

/** Medusa event bus / locking: requires a TCP `redis://` or `rediss://` URL. REST-only Upstash vars are not used here. */
const configuredRedisUrl =
  process.env.REDIS_URL?.trim() || process.env.MEDUSA_REDIS_URL?.trim() || "";
const redisUrl = (() => {
  if (!configuredRedisUrl) return "";
  try {
    const url = new URL(configuredRedisUrl);
    if (url.hostname.endsWith(".upstash.io") && url.protocol === "redis:") {
      url.protocol = "rediss:";
    }
    return url.toString();
  } catch {
    return configuredRedisUrl;
  }
})();

export default defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    ...(redisUrl ? { redisUrl } : {}),
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  admin: {
    // The standalone admin app owns the dashboard in hosted deployments.
    disable: process.env.MEDUSA_ADMIN_DISABLED === "true",
    backendUrl:
      process.env.MEDUSA_BACKEND_URL ||
      process.env.NEXT_PUBLIC_MEDUSA_URL ||
      "http://localhost:9000",
  },
  modules: [
    ...(paymentProviders.length
      ? [
          {
            resolve: "@medusajs/medusa/payment" as const,
            options: {
              providers: paymentProviders,
            },
          },
        ]
      : []),
  ],
});
