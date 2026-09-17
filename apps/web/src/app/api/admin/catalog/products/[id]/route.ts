import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { staffSessionAllows } from "@universal-music-store/database";
import { getStaffSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { insertStaffAuditLog } from "@/lib/staff-audit";
import {
  parseOptionalMatrixCellStocks,
  parseOptionalStockQuantity,
  parseOptionalVariantStocks,
} from "@/lib/parse-optional-stock-quantity";
import {
  parseStorefrontMetadataFromBody,
  parseVariantBarcodeFromBody,
  catalogProductRequestSchema,
} from "@/lib/parse-catalog-product-body";
import { parseAdminJson } from "@/lib/admin-api-security";
import { parseCatalogOptionArray } from "@/lib/parse-catalog-option-array";
import { resolveCatalogMediaReferences } from "@/lib/catalog-product-media-db";
import { correlatedJson } from "@/lib/staff-api-response";
import {
  buildStorefrontCommerceInvalidationPayload,
  notifyStorefrontCommerceInvalidation,
} from "@/lib/storefront-commerce-invalidation";
import {
  listCatalogProviderProjections,
  upsertPaymentProviderArtifact,
  upsertCatalogProviderProjection,
} from "@universal-music-store/platform-data";
import {
  stripeAvailableForMerchant,
  STRIPE_UNAVAILABLE_IN_MERCHANT_COUNTRY,
} from "@/lib/payment-country-policy";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { catalogSyncIdempotencyKey } from "@/lib/catalog-sync-idempotency";
import {
  archiveWorkerCatalogProviderForAdmin,
  deleteWorkerCatalogProductForAdmin,
  fetchWorkerCatalogProductDetailForAdmin,
  syncWorkerCatalogProviderForAdmin,
  updateWorkerCatalogProductForAdmin,
} from "@/lib/worker-admin-bridge";

export const dynamic = "force-dynamic";

async function syncStripeCatalogAfterUpdate(input: {
  productId: string;
  title: string;
  description?: string | null;
  handle?: string | null;
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
  const organization = await resolveStaffOrganization(
    sup.client,
    input.actorEmail,
  );
  if (!organization)
    return {
      state: "unavailable" as const,
      reason: "ORGANIZATION_NOT_CONFIGURED",
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
    operation: "update",
  });
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

type RouteParams = { params: Promise<{ id: string }> };

async function patch(req: Request, ctx: RouteParams) {
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
  const { id: productId } = await ctx.params;
  if (!productId) {
    return correlatedJson(
      correlationId,
      { error: "Missing id" },
      { status: 400 },
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
  // The Worker owns optimistic concurrency and validates expected_revision inside its transaction.
  const title = typeof body.title === "string" ? body.title : "";
  const handle = typeof body.handle === "string" ? body.handle : "";
  const pricePhp = Number(body.pricePhp);
  const status = body.status === "published" ? "published" : "draft";
  const categoryIds = Array.isArray(body.categoryIds)
    ? body.categoryIds.filter(
        (x): x is string => typeof x === "string" && x.trim().length > 0,
      )
    : [];
  const sizeLabelsArr = parseCatalogOptionArray(body.sizeLabels);
  const colorLabelsArr = parseCatalogOptionArray(body.colorLabels);
  if (
    !sizeLabelsArr ||
    !colorLabelsArr ||
    sizeLabelsArr.length < 1 ||
    colorLabelsArr.length < 1
  ) {
    return correlatedJson(
      correlationId,
      { error: "Select at least one size and one color." },
      { status: 400 },
    );
  }

  const stockParsed = parseOptionalStockQuantity(body);
  if (!stockParsed.ok) {
    return correlatedJson(
      correlationId,
      { error: stockParsed.error },
      { status: 400 },
    );
  }
  const variantStocksParsed = parseOptionalVariantStocks(body);
  if (!variantStocksParsed.ok) {
    return correlatedJson(
      correlationId,
      { error: variantStocksParsed.error },
      { status: 400 },
    );
  }
  const matrixCellStocksParsed = parseOptionalMatrixCellStocks(body);
  if (!matrixCellStocksParsed.ok) {
    return correlatedJson(
      correlationId,
      { error: matrixCellStocksParsed.error },
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
    const response = await updateWorkerCatalogProductForAdmin({ productId, idempotencyKey, body: { ...body, imageUrls, categoryIds, sizeLabels: sizeLabelsArr, colorLabels: colorLabelsArr, stockQuantity: stockParsed.value, variantStocks: variantStocksParsed.value, matrixCellStocks: matrixCellStocksParsed.value, variantBarcode, storefrontMetadata } });
    if (!response) return correlatedJson(correlationId, { error: "Commerce Worker is unavailable" }, { status: 503 });
    const payload = (await response.json().catch(() => ({}))) as { productId?: string; error?: string };
    if (!response.ok || !payload.productId) return correlatedJson(correlationId, { error: payload.error ?? "Product update failed" }, { status: response.status });
    const actorEmail = session.user.email?.trim();
    const stripeSync = await syncStripeCatalogAfterUpdate({ productId, title, description: typeof body.description === "string" ? body.description : null, handle, pricePhp, correlationId, actorEmail });
    const invalidation = await notifyStorefrontCommerceInvalidation(buildStorefrontCommerceInvalidationPayload({ classification: status === "published" ? "sellability_affecting" : "editorial_only", actorEmail, reason: status === "published" ? "A catalog product was updated." : undefined }));
    return correlatedJson(correlationId, { productId, mutationClassification: status === "published" ? "sellability_affecting" : "editorial_only", stripeCatalogSync: stripeSync, storefrontInvalidation: invalidation.ok ? "ok" : invalidation.error });
  }

  return correlatedJson(correlationId, { error: "Commerce Worker is not configured" }, { status: 503 });
}

async function deleteHandler(req: Request, ctx: RouteParams) {
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
  const { id: productId } = await ctx.params;
  if (!productId) {
    return correlatedJson(
      correlationId,
      { error: "Missing id" },
      { status: 400 },
    );
  }
  const beforeDetail = await fetchWorkerCatalogProductDetailForAdmin(productId).catch(
    () => null,
  );

  const actorEmail = session.user.email?.trim();
  const localAdminMode =
    process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";
  let stripeCatalogArchive: { state: string; reason?: string } = {
    state: "unavailable",
  };
  const supForProjection = adminSupabaseOr503(correlationId);
  if (!localAdminMode && "client" in supForProjection) {
    const projectionRows = await listCatalogProviderProjections(
      supForProjection.client,
      { medusaProductId: productId },
    );
    const stripe = new Map(
      projectionRows
        .filter((row) => row.provider === "stripe")
        .map((row) => [row.artifact_type, row.external_id]),
    );
    const hasStripeArtifacts = Boolean(
      stripe.get("product") ||
        stripe.get("price") ||
        stripe.get("payment_link"),
    );
    if (hasStripeArtifacts && process.env.API_URL?.trim()) {
      const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
      if (!idempotencyKey) {
        return correlatedJson(
          correlationId,
          { error: "Idempotency-Key is required", code: "IDEMPOTENCY_KEY_REQUIRED" },
          { status: 400 },
        );
      }
      const response = await archiveWorkerCatalogProviderForAdmin({
        idempotencyKey,
        body: {
          productExternalId: stripe.get("product"),
          priceExternalId: stripe.get("price"),
          paymentLinkExternalId: stripe.get("payment_link"),
          productId,
        },
      });
      if (!response?.ok) {
        return correlatedJson(
          correlationId,
          {
            error: "Provider archival failed; product was not deleted",
            code: "CATALOG_PROVIDER_ARCHIVE_FAILED",
          },
          { status: 502 },
        );
      }
      stripeCatalogArchive = { state: "archived" };
      for (const row of projectionRows.filter(
        (projection) => projection.provider === "stripe",
      )) {
        await upsertCatalogProviderProjection(supForProjection.client, {
          medusa_product_id: productId,
          provider: "stripe",
          artifact_type: row.artifact_type,
          external_id: row.external_id,
          external_url: row.external_url,
          sync_state: "disabled",
          sync_mode: "disabled",
          last_synced_at: new Date().toISOString(),
          last_error_code: null,
          last_error: null,
          last_failed_step: null,
          correlation_id: correlationId,
          idempotency_key: row.idempotency_key,
          updated_by_email: actorEmail ?? null,
        });
      }
    }
  }

  let deleted: boolean;
  if (process.env.API_URL?.trim()) {
    const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
    if (!idempotencyKey) {
      return correlatedJson(correlationId, { error: "Idempotency-Key is required" }, { status: 400 });
    }
    const response = await deleteWorkerCatalogProductForAdmin({ productId, idempotencyKey });
    if (!response) return correlatedJson(correlationId, { error: "Commerce Worker is unavailable" }, { status: 503 });
    const payload = (await response.json().catch(() => ({}))) as { deleted?: boolean; error?: string };
    if (!response.ok || payload.deleted !== true) {
      return correlatedJson(correlationId, { error: payload.error ?? "Product deletion failed" }, { status: response.status });
    }
    deleted = true;
  } else {
    return correlatedJson(correlationId, { error: "Commerce Worker is not configured" }, { status: 503 });
  }

  if (actorEmail && !localAdminMode) {
    const sup = adminSupabaseOr503(correlationId);
    if ("client" in sup) {
      await insertStaffAuditLog(sup.client, {
        actorEmail,
        action: "catalog.product.delete",
        resource: `product:${productId}`,
        details: {},
      });
      await sup.client
        .from("admin_entity_workflow")
        .delete()
        .eq("organization_id", (await resolveStaffOrganization(sup.client, actorEmail))?.id ?? "")
        .eq("entity_type", "catalog_product")
        .eq("entity_id", productId);
    }
  }
  const invalidation = await notifyStorefrontCommerceInvalidation(
    buildStorefrontCommerceInvalidationPayload({
      classification:
        beforeDetail?.status === "published"
          ? "sellability_affecting"
          : "editorial_only",
      actorEmail,
      reason:
        beforeDetail?.status === "published"
          ? "A product was removed from the catalog. Review your order before continuing."
          : undefined,
    }),
  );
  if (!invalidation.ok) {
    console.warn(
      "[admin catalog delete] storefront invalidation:",
      invalidation.error,
    );
  }

  return correlatedJson(correlationId, {
    deleted,
    mutationClassification:
      beforeDetail?.status === "published"
        ? "sellability_affecting"
        : "editorial_only",
    storefrontInvalidation: invalidation.ok ? "ok" : invalidation.error,
    stripeCatalogArchive,
  });
}

export const PATCH = withAdminMutationIdempotency("/admin/catalog/products/[id]:PATCH", patch);
export const DELETE = withAdminMutationIdempotency("/admin/catalog/products/[id]:DELETE", deleteHandler);
