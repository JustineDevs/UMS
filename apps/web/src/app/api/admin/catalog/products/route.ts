import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { staffSessionAllows } from "@universal-music-store/database";
import { getStaffSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { insertStaffAuditLog } from "@/lib/staff-audit";
import { parseOptionalStockQuantity } from "@/lib/parse-optional-stock-quantity";
import {
  parseStorefrontMetadataFromBody,
  parseVariantBarcodeFromBody,
  catalogProductRequestSchema,
} from "@/lib/parse-catalog-product-body";
import { parseAdminJson } from "@/lib/admin-api-security";
import {
  collectCatalogMediaUrlsFromBody,
  resolveCatalogMediaReferences,
} from "@/lib/catalog-product-media-db";
import { correlatedJson } from "@/lib/staff-api-response";
import {
  ensureExternalCatalogProductMediaRows,
  upsertPaymentProviderArtifact,
} from "@universal-music-store/platform-data";
import {
  listCatalogProviderProjections,
  upsertCatalogProviderProjection,
} from "@universal-music-store/platform-data";
import {
  buildStorefrontCommerceInvalidationPayload,
  notifyStorefrontCommerceInvalidation,
} from "@/lib/storefront-commerce-invalidation";
import {
  stripeAvailableForMerchant,
  STRIPE_UNAVAILABLE_IN_MERCHANT_COUNTRY,
} from "@/lib/payment-country-policy";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { catalogSyncIdempotencyKey } from "@/lib/catalog-sync-idempotency";
import {
  createWorkerCatalogProductForAdmin,
  syncWorkerCatalogProviderForAdmin,
} from "@/lib/worker-admin-bridge";

export const dynamic = "force-dynamic";

async function syncStripeCatalogAfterCreate(input: {
  productId: string;
  title: string;
  description?: string;
  handle?: string;
  pricePhp: number;
  correlationId: string;
  actorEmail?: string;
}) {
  const sup = adminSupabaseOr503(input.correlationId);
  if (!("client" in sup)) return { state: "unavailable" as const };
  if (!stripeAvailableForMerchant())
    return {
      state: "unavailable" as const,
      reason: STRIPE_UNAVAILABLE_IN_MERCHANT_COUNTRY,
    };
  const projections = await listCatalogProviderProjections(sup.client, {
    medusaProductId: input.productId,
  });
  const existing = new Map(
    projections
      .filter((row) => row.provider === "stripe")
      .map((row) => [row.artifact_type, row]),
  );
  const idempotencyKey = catalogSyncIdempotencyKey({
    productId: input.productId,
    title: input.title,
    description: input.description,
    handle: input.handle,
    pricePhp: input.pricePhp,
    operation: "create",
  });
  const organization = await resolveStaffOrganization(
    sup.client,
    input.actorEmail,
  );
  if (!organization)
    return {
      state: "unavailable" as const,
      reason: "ORGANIZATION_NOT_CONFIGURED",
    };
  try {
    const response = await syncWorkerCatalogProviderForAdmin({
      idempotencyKey,
      body: {
        productId: input.productId,
        title: input.title,
        description: input.description ?? null,
        handle: input.handle ?? null,
        amountMinor: Math.round(input.pricePhp * 100),
        currency: "PHP",
        siteOrigin:
          process.env.STOREFRONT_PUBLIC_URL ??
          process.env.NEXT_PUBLIC_SITE_URL ??
          null,
        includePaymentLink: true,
        productExternalId: existing.get("product")?.external_id ?? null,
        priceExternalId: existing.get("price")?.external_id ?? null,
        paymentLinkExternalId:
          existing.get("payment_link")?.external_id ?? null,
      },
    });
    if (!response) return { state: "unavailable" as const, reason: "WORKER_NOT_CONFIGURED" };
    const payload = (await response.json().catch(() => ({}))) as {
      data?: {
        productId?: string;
        priceId?: string;
        paymentLinkId?: string;
        paymentLinkUrl?: string;
      };
      error?: string;
      code?: string;
    };
    if (!response.ok || !payload.data?.productId || !payload.data.priceId) {
      for (const artifactType of [
        "product",
        "price",
        "payment_link",
      ] as const) {
        await upsertCatalogProviderProjection(sup.client, {
          medusa_product_id: input.productId,
          provider: "stripe",
          artifact_type: artifactType,
          sync_state: "failed",
          sync_mode: "automatic",
          last_error_code: payload.code ?? "STRIPE_CATALOG_SYNC_FAILED",
          last_error: payload.error ?? "Stripe catalog synchronization failed",
          last_failed_step: artifactType,
          correlation_id: input.correlationId,
          idempotency_key: idempotencyKey,
          updated_by_email: input.actorEmail ?? null,
        });
      }
      return {
        state: "failed" as const,
        reason: payload.error ?? "Stripe catalog synchronization failed",
      };
    }
    const values = {
      product: { external_id: payload.data.productId },
      price: { external_id: payload.data.priceId },
      payment_link: {
        external_id: payload.data.paymentLinkId ?? null,
        external_url: payload.data.paymentLinkUrl ?? null,
      },
    } as const;
    for (const artifactType of ["product", "price", "payment_link"] as const) {
      await upsertCatalogProviderProjection(sup.client, {
        medusa_product_id: input.productId,
        provider: "stripe",
        artifact_type: artifactType,
        ...values[artifactType],
        sync_state: "synced",
        sync_mode: "automatic",
        last_synced_at: new Date().toISOString(),
        correlation_id: input.correlationId,
        idempotency_key: idempotencyKey,
        updated_by_email: input.actorEmail ?? null,
      });
      const externalId = values[artifactType].external_id;
      if (externalId) {
        await upsertPaymentProviderArtifact(sup.client, {
          organization_id: organization.id,
          merchant_identity:
            input.actorEmail?.trim().toLowerCase() || "local-admin",
          provider: "stripe",
          artifact_type: artifactType,
          external_id: externalId,
          parent_external_id:
            artifactType === "price" ? values.product.external_id : null,
          status: "synced",
          currency: "PHP",
          amount_minor:
            artifactType === "price" ? Math.round(input.pricePhp * 100) : null,
          metadata: { medusa_product_id: input.productId },
          idempotency_key: idempotencyKey,
        });
      }
    }
    return {
      state: "synced" as const,
      paymentLinkUrl: payload.data.paymentLinkUrl ?? null,
    };
  } catch (error) {
    return {
      state: "failed" as const,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function post(req: Request) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(
      correlationId,
      { error: "Unauthorized" },
      { status: 401 },
    );
  }
  if (!staffSessionAllows(session, "catalog:write")) {
    return correlatedJson(
      correlationId,
      { error: "Forbidden" },
      { status: 403 },
    );
  }
  const parsedBody = await parseAdminJson(
    req,
    catalogProductRequestSchema,
    512_000,
  );
  if (!parsedBody.ok) {
    return correlatedJson(
      correlationId,
      { error: parsedBody.error },
      { status: parsedBody.status },
    );
  }
  const body = parsedBody.data;
  const title = typeof body.title === "string" ? body.title : "";
  const pricePhp = Number(body.pricePhp);
  const status = body.status === "published" ? "published" : "draft";
  const categoryIds = Array.isArray(body.categoryIds)
    ? body.categoryIds.filter(
        (x): x is string => typeof x === "string" && x.trim().length > 0,
      )
    : [];
  const stockParsed = parseOptionalStockQuantity(body);
  if (!stockParsed.ok) {
    return correlatedJson(
      correlationId,
      { error: stockParsed.error },
      { status: 400 },
    );
  }

  const storefrontMetadata = parseStorefrontMetadataFromBody(body);
  const variantBarcode = parseVariantBarcodeFromBody(body);

  const imageUrlsRaw = body.imageUrls;
  let imageUrls = Array.isArray(imageUrlsRaw)
    ? imageUrlsRaw
        .filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0,
        )
        .map((s) => s.trim())
    : undefined;

  if (storefrontMetadata?.mediaIds.length) {
    const mediaSup = adminSupabaseOr503(correlationId);
    if ("response" in mediaSup) return mediaSup.response;
    const organization = await resolveStaffOrganization(mediaSup.client, session.user.email);
    if (!organization) {
      return correlatedJson(correlationId, { error: "Organization membership is not configured" }, { status: 403 });
    }
    try {
      imageUrls = await resolveCatalogMediaReferences(mediaSup.client, storefrontMetadata.mediaIds, organization.id);
    } catch (error) {
      return correlatedJson(correlationId, { error: error instanceof Error ? error.message : "Invalid catalog media references" }, { status: 400 });
    }
  }

  if (process.env.API_URL?.trim()) {
    const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
    if (!idempotencyKey) return correlatedJson(correlationId, { error: "Idempotency-Key is required" }, { status: 400 });
    const response = await createWorkerCatalogProductForAdmin({
      idempotencyKey,
      body: { ...body, imageUrls, categoryIds, stockQuantity: stockParsed.value, variantBarcode, storefrontMetadata },
    });
    if (!response) return correlatedJson(correlationId, { error: "Commerce Worker is unavailable" }, { status: 503 });
    const payload = (await response.json().catch(() => ({}))) as { productId?: string; error?: string };
    if (!response.ok || !payload.productId) return correlatedJson(correlationId, { error: payload.error ?? "Product creation failed" }, { status: response.status });
    const workerResult = { ok: true as const, data: { productId: payload.productId } };
    const actorEmail = session.user.email?.trim();
    const sup = adminSupabaseOr503(correlationId);
    if ("client" in sup) {
      await ensureExternalCatalogProductMediaRows(sup.client, collectCatalogMediaUrlsFromBody(body));
      if (actorEmail) await insertStaffAuditLog(sup.client, { actorEmail, action: "catalog.product.create", resource: `product:${payload.productId}`, details: { title: title.trim() } });
    }
    const stripeSync = await syncStripeCatalogAfterCreate({ productId: payload.productId, title, description: typeof body.description === "string" ? body.description : undefined, handle: typeof body.handle === "string" ? body.handle : undefined, pricePhp, correlationId, actorEmail });
    const invalidation = await notifyStorefrontCommerceInvalidation(buildStorefrontCommerceInvalidationPayload({ classification: status === "published" ? "sellability_affecting" : "editorial_only", actorEmail, reason: status === "published" ? "A catalog product was published." : undefined }));
    return correlatedJson(correlationId, { productId: workerResult.data.productId, mutationClassification: status === "published" ? "sellability_affecting" : "editorial_only", stripeCatalogSync: stripeSync, storefrontInvalidation: invalidation.ok ? "ok" : invalidation.error }, { status: 201 });
  }

  return correlatedJson(correlationId, { error: "Commerce Worker is not configured" }, { status: 503 });
}

export const POST = withAdminMutationIdempotency(
  "/admin/catalog/products:POST",
  post,
);
