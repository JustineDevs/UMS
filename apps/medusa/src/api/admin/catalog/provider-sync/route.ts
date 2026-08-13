import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import Stripe from "stripe";
import { archiveStripeCatalog, syncStripeCatalog, type StripeCatalogSyncInput } from "../../../../lib/stripe-catalog-client";
import { getNangoPaymentCredentials } from "../../../../lib/nango-payment-credentials";

function validInternalToken(req: MedusaRequest): boolean {
  const expected = process.env.MEDUSA_INTERNAL_ADMIN_TOKEN?.trim();
  return Boolean(expected && req.headers["x-uvs-internal-token"] === expected);
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  if (!validInternalToken(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = (req.body ?? {}) as Partial<StripeCatalogSyncInput> & {
    nango_connection_id?: string;
    nango_provider_config_key?: string;
  };
  const nangoCredentials = await getNangoPaymentCredentials({
    nango_connection_id: body.nango_connection_id,
    nango_provider_config_key: body.nango_provider_config_key,
  });
  const apiKey = String(
    nangoCredentials?.access_token ??
    nangoCredentials?.secret_key ??
    ""
  ).trim();
  if (!apiKey) {
    res.status(503).json({ error: "Stripe catalog synchronization is not configured", code: "STRIPE_NOT_CONFIGURED" });
    return;
  }
  try {
    const result = await syncStripeCatalog(new Stripe(apiKey, { typescript: true }), {
      productId: String(body.productId ?? ""),
      title: String(body.title ?? ""),
      description: body.description == null ? null : String(body.description),
      handle: body.handle == null ? null : String(body.handle),
      amountMinor: Number(body.amountMinor),
      currency: String(body.currency ?? "PHP"),
      siteOrigin: body.siteOrigin == null ? null : String(body.siteOrigin),
      includePaymentLink: body.includePaymentLink !== false,
      productExternalId: body.productExternalId == null ? null : String(body.productExternalId),
      priceExternalId: body.priceExternalId == null ? null : String(body.priceExternalId),
      paymentLinkExternalId: body.paymentLinkExternalId == null ? null : String(body.paymentLinkExternalId),
      idempotencyKey: String(body.idempotencyKey ?? ""),
    });
    res.json({ data: result, provider: "stripe", sync_state: "synced" });
  } catch (error) {
    console.error("Stripe catalog synchronization failed", error);
    res.status(502).json({
      error: "Stripe catalog synchronization failed",
      code: "STRIPE_CATALOG_SYNC_FAILED",
    });
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  if (!validInternalToken(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = (req.body ?? {}) as {
    productExternalId?: string | null;
    priceExternalId?: string | null;
    paymentLinkExternalId?: string | null;
    nango_connection_id?: string;
    nango_provider_config_key?: string;
  };
  const nangoCredentials = await getNangoPaymentCredentials({
    nango_connection_id: body.nango_connection_id,
    nango_provider_config_key: body.nango_provider_config_key,
  });
  const apiKey = String(
    nangoCredentials?.access_token ??
      nangoCredentials?.secret_key ??
      "",
  ).trim();
  if (!apiKey) {
    res.status(503).json({ error: "Stripe catalog synchronization is not configured", code: "STRIPE_NOT_CONFIGURED" });
    return;
  }
  try {
    await archiveStripeCatalog(new Stripe(apiKey, { typescript: true }), body);
    res.json({ archived: true, provider: "stripe" });
  } catch {
    res.status(502).json({ error: "Stripe catalog archival failed", code: "STRIPE_CATALOG_ARCHIVE_FAILED" });
  }
}
