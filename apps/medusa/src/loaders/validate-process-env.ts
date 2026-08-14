/**
 * Medusa process boot validation (Zod). Imported from medusa-config after loadEnv.
 */
import { z } from "zod";

const devOk = z.string().min(1);

function nangoIntegrationConfigured(...keys: string[]): boolean {
  const configured = new Set(
    (process.env.NANGO_PAYMENT_INTEGRATIONS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  return Boolean(process.env.NANGO_API_KEY?.trim()) && keys.some((key) => {
    const normalized = key.toLowerCase();
    return configured.has(normalized) || configured.has(`${normalized}-sandbox`);
  });
}

function productionStripeSchema() {
  return z
    .object({
      STRIPE_API_KEY: z.string().optional(),
      STRIPE_WEBHOOK_SECRET: z.string().optional(),
    })
    .refine(
      (d) => {
        if (!d.STRIPE_API_KEY?.trim() && !nangoIntegrationConfigured("stripe")) return true;
        return Boolean(d.STRIPE_WEBHOOK_SECRET?.trim());
      },
      {
        message:
          "STRIPE_WEBHOOK_SECRET is required in production when Stripe is configured directly or through Nango",
      },
    );
}

function productionXenditSchema() {
  return z
    .object({
      XENDIT_SECRET_KEY: z.string().optional(),
      XENDIT_WEBHOOK_TOKEN: z.string().optional(),
    })
    .refine(
      (d) => {
        if (!d.XENDIT_SECRET_KEY?.trim()) return true;
        return Boolean(d.XENDIT_WEBHOOK_TOKEN?.trim());
      },
      {
        message:
          "XENDIT_WEBHOOK_TOKEN is required in production when XENDIT_SECRET_KEY is set",
      },
    );
}

function productionPancakePosSchema() {
  return z
    .object({
      PANCAKE_POS_API_URL: z.string().optional(),
      PANCAKE_POS_API_KEY: z.string().optional(),
      PANCAKE_POS_SHOP_ID: z.string().optional(),
    })
    .refine(
      (d) => {
        if (!d.PANCAKE_POS_API_KEY?.trim()) return true;
        return Boolean(d.PANCAKE_POS_SHOP_ID?.trim());
      },
      {
        message:
          "PANCAKE_POS_SHOP_ID is required in production when PANCAKE_POS_API_KEY is set",
      },
    );
}

function productionPayPalSchema() {
  return z
    .object({
      PAYPAL_CLIENT_ID: z.string().optional(),
      PAYPAL_CLIENT_SECRET: z.string().optional(),
      PAYPAL_WEBHOOK_ID: z.string().optional(),
    })
    .refine(
      (d) => {
        if (nangoIntegrationConfigured("paypal")) return true;
        if (!d.PAYPAL_CLIENT_ID?.trim()) return true;
        return Boolean(d.PAYPAL_CLIENT_SECRET?.trim());
      },
      {
        message:
          "PAYPAL_CLIENT_SECRET is required in production when PAYPAL_CLIENT_ID is set",
      },
    )
    .refine(
      (d) => {
        if (!d.PAYPAL_CLIENT_ID?.trim() && !nangoIntegrationConfigured("paypal")) return true;
        return Boolean(d.PAYPAL_WEBHOOK_ID?.trim());
      },
      {
        message:
          "PAYPAL_WEBHOOK_ID is required in production when PAYPAL_CLIENT_ID is set (webhook signature verification)",
      },
    );
}

function warnPartialOptionalProvider(
  name: string,
  keys: string[],
  env: Record<string, string | undefined>,
): void {
  const set = keys.filter((k) => Boolean(env[k]?.trim()));
  if (set.length > 0 && set.length < keys.length) {
    const missing = keys.filter((k) => !env[k]?.trim());
    console.warn(
      `[env] ${name}: partially configured (set: ${set.join(", ")}; missing: ${missing.join(", ")}). Feature may not work.`,
    );
  }
}

export function validateMedusaProcessEnv(): void {
  const db = z.object({
    DATABASE_URL: devOk,
  });
  const r = db.safeParse(process.env);
  if (!r.success) {
    throw new Error(
      `Medusa: DATABASE_URL is required — ${r.error.message}`,
    );
  }

  // Always-on: PSP webhook secrets are required whenever the corresponding key is set,
  // regardless of NODE_ENV. A missing webhook secret means unsigned webhooks are accepted — never safe.
  if (process.env.XENDIT_SECRET_KEY?.trim() && !process.env.XENDIT_WEBHOOK_TOKEN?.trim()) {
    throw new Error(
      "Medusa: XENDIT_WEBHOOK_TOKEN is required when XENDIT_SECRET_KEY is set",
    );
  }
  if (process.env.PANCAKE_POS_API_KEY?.trim() && !process.env.PANCAKE_POS_SHOP_ID?.trim()) {
    throw new Error(
      "Medusa: PANCAKE_POS_SHOP_ID is required when PANCAKE_POS_API_KEY is set",
    );
  }

  if (process.env.NODE_ENV === "production") {
    const jwt = process.env.JWT_SECRET?.trim() ?? "";
    const cookie = process.env.COOKIE_SECRET?.trim() ?? "";
    if (jwt === "supersecret" || cookie === "supersecret") {
      throw new Error(
        "Medusa: JWT_SECRET and COOKIE_SECRET must not use default 'supersecret' in production",
      );
    }
    if (!jwt.length || !cookie.length) {
      throw new Error(
        "Medusa: JWT_SECRET and COOKIE_SECRET are required in production",
      );
    }

    const storeCors = process.env.STORE_CORS?.trim() ?? "";
    const adminCors = process.env.ADMIN_CORS?.trim() ?? "";
    const authCors = process.env.AUTH_CORS?.trim() ?? "";
    if (!storeCors || !adminCors || !authCors) {
      const missing: string[] = [];
      if (!storeCors) missing.push("STORE_CORS");
      if (!adminCors) missing.push("ADMIN_CORS");
      if (!authCors) missing.push("AUTH_CORS");
      throw new Error(
        `Medusa: required CORS env in production: ${missing.join(", ")}`,
      );
    }

    const stripe = productionStripeSchema().safeParse(process.env);
    if (!stripe.success) {
      throw new Error(
        `Medusa: ${stripe.error.issues[0]?.message ?? "Stripe env invalid"}`,
      );
    }

    const paypal = productionPayPalSchema().safeParse(process.env);
    if (!paypal.success) {
      throw new Error(
        `Medusa: ${paypal.error.issues[0]?.message ?? "PayPal env invalid"}`,
      );
    }

    const xendit = productionXenditSchema().safeParse(process.env);
    if (!xendit.success) {
      throw new Error(
        `Medusa: ${xendit.error.issues[0]?.message ?? "Xendit env invalid"}`,
      );
    }

    const pancakePos = productionPancakePosSchema().safeParse(process.env);
    if (!pancakePos.success) {
      throw new Error(
        `Medusa: ${pancakePos.error.issues[0]?.message ?? "Pancake POS env invalid"}`,
      );
    }

    if (process.env.PAYPAL_CLIENT_ID?.trim() || nangoIntegrationConfigured("paypal")) {
      const pe = process.env.PAYPAL_ENVIRONMENT?.trim().toLowerCase() ?? "";
      if (pe !== "production" && pe !== "live") {
        throw new Error(
        "Medusa: PAYPAL_ENVIRONMENT must be production when PayPal is configured directly or through Nango",
        );
      }
    }
  }

  const resendKeys = ["RESEND_API_KEY", "RESEND_FROM_EMAIL"];
  warnPartialOptionalProvider("Resend", resendKeys, process.env as Record<string, string | undefined>);
  warnPartialOptionalProvider(
    "Pancake POS",
    ["PANCAKE_POS_API_URL", "PANCAKE_POS_API_KEY", "PANCAKE_POS_SHOP_ID"],
    process.env as Record<string, string | undefined>,
  );
  if (
    resendKeys.every((k) => process.env[k]?.trim()) &&
    !process.env.TRACKING_HMAC_SECRET?.trim()
  ) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Medusa: TRACKING_HMAC_SECRET is required in production when Resend is configured — tracking links would be unsigned without it",
      );
    }
    console.warn(
      "[env] Resend is configured but TRACKING_HMAC_SECRET is not set — order tracking links will be unsigned; set TRACKING_HMAC_SECRET before production",
    );
  }
}
