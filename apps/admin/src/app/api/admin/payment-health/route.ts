import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { staffSessionAllows } from "@apparel-commerce/database";
import { authOptions } from "@/lib/auth";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";

type ProviderStatus = {
  enabled: boolean;
  webhookConfigured: boolean;
  sandboxMode?: boolean;
  notes?: string;
};

/**
 * PH-19: Payment provider health check.
 * Reports whether each PSP is configured, its webhook is set, and whether
 * sandbox/production mode is correct. Operators and CI can query this
 * endpoint to verify payment readiness before deploying.
 *
 * GET /api/admin/payment-health
 */
export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "payments:read")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }

  const env = process.env;

  const stripe: ProviderStatus = {
    enabled: Boolean(env.STRIPE_API_KEY?.trim()),
    webhookConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET?.trim()),
  };

  const paypal: ProviderStatus = {
    enabled: Boolean(env.PAYPAL_CLIENT_ID?.trim() && env.PAYPAL_CLIENT_SECRET?.trim()),
    webhookConfigured: Boolean(env.PAYPAL_WEBHOOK_ID?.trim()),
    sandboxMode: env.PAYPAL_ENVIRONMENT?.trim().toLowerCase() !== "live",
    notes: !env.PAYPAL_WEBHOOK_ID?.trim()
      ? "PAYPAL_WEBHOOK_ID is required in production. Register the webhook in PayPal Developer Dashboard -> My Apps -> Webhooks."
      : undefined,
  };

  const paymongo: ProviderStatus = {
    enabled: Boolean(env.PAYMONGO_SECRET_KEY?.trim()),
    webhookConfigured: Boolean(env.PAYMONGO_WEBHOOK_SECRET?.trim()),
  };

  const maya: ProviderStatus = {
    enabled: Boolean(env.MAYA_SECRET_KEY?.trim()),
    webhookConfigured: Boolean(env.MAYA_WEBHOOK_SECRET?.trim()),
    sandboxMode: env.MAYA_SANDBOX?.trim().toLowerCase() !== "false",
    notes: !env.MAYA_WEBHOOK_SECRET?.trim()
      ? "MAYA_WEBHOOK_SECRET required for production signature verification."
      : undefined,
  };

  const cod: ProviderStatus = {
    enabled: true,
    webhookConfigured: true,
    notes: "COD does not use webhooks. Fulfilled manually by staff.",
  };

  const vercelEnv = env.VERCEL_ENV?.trim();
  const nodeEnv = env.NODE_ENV?.trim();
  const isProduction = vercelEnv === "production" || nodeEnv === "production";

  const warnings: string[] = [];

  if (isProduction) {
    if (paypal.enabled && !paypal.webhookConfigured) {
      warnings.push("PayPal is enabled but PAYPAL_WEBHOOK_ID is not set — PayPal webhook verification will fail.");
    }
    if (paypal.enabled && !paypal.sandboxMode === false) {
      warnings.push("PayPal appears to be in sandbox mode in production.");
    }
    if (maya.enabled && !maya.webhookConfigured) {
      warnings.push("Maya is enabled but MAYA_WEBHOOK_SECRET is not set — webhook signatures cannot be verified.");
    }
    if (maya.enabled && maya.sandboxMode) {
      warnings.push("Maya appears to be in sandbox mode in production.");
    }
    if (stripe.enabled && !stripe.webhookConfigured) {
      warnings.push("Stripe is enabled but STRIPE_WEBHOOK_SECRET is not set.");
    }
  }

  return correlatedJson(cid, {
    environment: vercelEnv ?? nodeEnv ?? "unknown",
    isProduction,
    providers: { stripe, paypal, paymongo, maya, cod },
    warnings,
    ok: warnings.length === 0,
  });
}
