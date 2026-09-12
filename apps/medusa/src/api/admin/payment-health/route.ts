import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  buildPaymentPlatformAlerts,
  getPaymentPlatformMetrics,
  tryCreateSupabaseClient,
} from "../../../lib/payment-supabase-bridge";
import { nangoPaymentProviderConfigured } from "../../../lib/nango-payment-credentials";

type ProviderStatus = {
  configured: boolean;
  hasWebhookSecret: boolean;
};

function checkProvider(
  keyEnv: string,
  webhookEnv?: string,
): ProviderStatus {
  return {
    configured: Boolean(process.env[keyEnv]?.trim()),
    hasWebhookSecret: webhookEnv
      ? Boolean(process.env[webhookEnv]?.trim())
      : true,
  };
}

/**
 * Reports payment provider env configuration and Supabase ledger / job backlog metrics when available.
 */
export async function GET(
  _req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const providers: Record<string, ProviderStatus> = {
    stripe: {
      configured: nangoPaymentProviderConfigured("stripe"),
      hasWebhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
    },
    paypal: {
      configured: nangoPaymentProviderConfigured(["paypal", "paypal-sandbox"]),
      hasWebhookSecret: Boolean(process.env.PAYPAL_WEBHOOK_ID?.trim()),
    },
    xendit: checkProvider("XENDIT_SECRET_KEY", "XENDIT_WEBHOOK_TOKEN"),
    cod: { configured: true, hasWebhookSecret: true },
  };

  const configuredCount = Object.values(providers).filter(
    (p) => p.configured,
  ).length;

  const supabaseConfigured = Boolean(
    process.env.SUPABASE_URL?.trim() &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim()),
  );

  let platformMetrics: Awaited<ReturnType<typeof getPaymentPlatformMetrics>> = null;
  const sb = tryCreateSupabaseClient();
  if (sb) {
    platformMetrics = await getPaymentPlatformMetrics(sb);
  }

  const cronSecretConfigured = Boolean(process.env.STOREFRONT_PAYMENT_CRON_SECRET?.trim());
  const storefrontOriginConfigured = Boolean(process.env.STOREFRONT_ORIGIN?.trim());
  const reconciliationConfigured = cronSecretConfigured && storefrontOriginConfigured;
  const alerts = platformMetrics ? buildPaymentPlatformAlerts(platformMetrics) : [];

  res.json({
    configuredCount,
    providers,
    timestamp: new Date().toISOString(),
    supabaseConfigured,
    storefrontReconciliation: {
      description:
        "Durable payment state in Supabase payment_attempts. Stale rows recover via storefront GET /api/cron/finalize-payment-attempts and admin /admin/payments.",
      medusaRole:
        "Medusa remains PSP webhooks and order or capture source of truth; ledger bridges hosted pay and COD capture.",
      cronSecretConfigured,
      storefrontOriginConfigured,
      reconciliationConfigured,
      ledgerMetrics: platformMetrics,
      alerts,
      alerting: {
        measured: [
          "stale_finalize_attempts",
          "needs_review_attempts",
          "unprocessed_webhook_backlog",
          "outbox_backlog",
          "failed_background_jobs",
          "cod_capture_backlog",
          "webhook_signature_failures_24h",
          "webhook_dedup_anomalies_24h",
        ],
        pendingInstrumentation: [],
      },
    },
  });
}
