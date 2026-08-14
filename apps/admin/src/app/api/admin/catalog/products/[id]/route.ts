import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { staffSessionAllows } from "@universal-music-store/database";
import { getStaffSession } from "@/lib/requireStaffSession";
import { createMedusaCatalogOperations } from "@/domain/operations/catalog-operations";
import { upsertEntityWorkflow } from "@/lib/admin-workflow";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { jsonFromAdminOperationResult } from "@/lib/staff-api-operation";
import { insertStaffAuditLog } from "@/lib/staff-audit";
import { fetchCatalogProductDetail } from "@/lib/medusa-catalog-service";
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
import { collectCatalogMediaUrlsFromBody } from "@/lib/catalog-product-media-db";
import { correlatedJson } from "@/lib/staff-api-response";
import { ensureExternalCatalogProductMediaRows } from "@universal-music-store/platform-data";
import {
  buildStorefrontCommerceInvalidationPayload,
  classifyCatalogMutation,
  notifyStorefrontCommerceInvalidation,
} from "@/lib/storefront-commerce-invalidation";
import { logAdminCatalogMutationClassified } from "@/lib/commerce-observability-log";
import { medusaAdminFetch } from "@/lib/medusa-admin-http";
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
  const internalToken = process.env.MEDUSA_INTERNAL_ADMIN_TOKEN?.trim();
  if (!internalToken) {
    return {
      state: "pending" as const,
      reason: "MEDUSA_INTERNAL_ADMIN_TOKEN is not configured",
    };
  }
  const merchantIdentity = input.actorEmail?.trim().toLowerCase();
  const organization = await resolveStaffOrganization(
    sup.client,
    input.actorEmail,
  );
  if (!organization)
    return {
      state: "unavailable" as const,
      reason: "ORGANIZATION_NOT_CONFIGURED",
    };
  const { data: nangoConnection } =
    merchantIdentity && organization
      ? await sup.client
          .from("payment_nango_connections")
          .select("nango_connection_id,provider_config_key")
          .eq("organization_id", organization.id)
          .eq("provider", "stripe")
          .eq("active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };
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
    const response = await medusaAdminFetch("/admin/catalog/provider-sync", {
      method: "POST",
      headers: { "x-uvs-internal-token": internalToken },
      body: JSON.stringify({
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
        idempotencyKey,
        ...(nangoConnection?.nango_connection_id
          ? {
              nango_connection_id: nangoConnection.nango_connection_id,
              nango_provider_config_key: nangoConnection.provider_config_key,
            }
          : {}),
      }),
    });
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
  const beforeDetail = await fetchCatalogProductDetail(productId).catch(
    () => null,
  );
  const expectedRevision =
    typeof body.expected_revision === "string"
      ? body.expected_revision.trim()
      : "";
  if (expectedRevision && beforeDetail && beforeDetail.revision !== expectedRevision) {
    return correlatedJson(
      correlationId,
      { error: "Product changed; reload before saving", code: "CATALOG_CONFLICT" },
      { status: 409 },
    );
  }
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
  const imageUrls = Array.isArray(imageUrlsRaw)
    ? imageUrlsRaw
        .filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0,
        )
        .map((s) => s.trim())
    : undefined;

  const ops = createMedusaCatalogOperations();
  const result = await ops.updateProduct(productId, {
    title,
    handle,
    description: typeof body.description === "string" ? body.description : null,
    status,
    pricePhp: Number.isFinite(pricePhp) ? pricePhp : NaN,
    sku: typeof body.sku === "string" ? body.sku : null,
    imageUrls,
    thumbnail: typeof body.thumbnail === "string" ? body.thumbnail : null,
    categoryIds,
    sizeLabels: sizeLabelsArr,
    colorLabels: colorLabelsArr,
    stockQuantity: stockParsed.value,
    variantStocks: variantStocksParsed.value,
    matrixCellStocks: matrixCellStocksParsed.value,
    variantBarcode,
    storefrontMetadata,
  });

  if (!result.ok) {
    return jsonFromAdminOperationResult(correlationId, result, 502);
  }

  const actorEmail = session.user.email?.trim();
  const sup = adminSupabaseOr503(correlationId);
  if ("client" in sup) {
    await ensureExternalCatalogProductMediaRows(
      sup.client,
      collectCatalogMediaUrlsFromBody(body),
    );
    if (actorEmail) {
      const organization = await resolveStaffOrganization(sup.client, actorEmail);
      await insertStaffAuditLog(sup.client, {
        actorEmail,
        action: "catalog.product.update",
        resource: `product:${productId}`,
        details: { title: title.trim() },
      });
      if (organization) {
        await upsertEntityWorkflow(sup.client, {
          organizationId: organization.id,
          entityType: "catalog_product",
          entityId: productId,
          state: status === "published" ? "published" : "draft",
          actorEmail,
        });
      }
    }
  }
  const afterDetail = await fetchCatalogProductDetail(
    result.data.productId,
  ).catch(() => null);
  const classification = classifyCatalogMutation(beforeDetail, afterDetail);
  logAdminCatalogMutationClassified({
    classification,
    productId: result.data.productId,
    correlationId,
    actorEmail,
  });
  const invalidation = await notifyStorefrontCommerceInvalidation(
    buildStorefrontCommerceInvalidationPayload({
      classification,
      before: beforeDetail,
      after: afterDetail,
      actorEmail,
      reason:
        classification === "checkout_affecting"
          ? "A catalog change affected your order. Review the updated price, availability, and total before continuing."
          : classification === "sellability_affecting"
            ? "Availability, publish state, or variant options changed for an item in your order. Review before continuing."
            : undefined,
    }),
  );
  if (!invalidation.ok) {
    console.warn(
      "[admin catalog update] storefront invalidation:",
      invalidation.error,
    );
  }

  const stripeSync = await syncStripeCatalogAfterUpdate({
    productId: result.data.productId,
    title,
    description: typeof body.description === "string" ? body.description : null,
    handle,
    pricePhp,
    correlationId,
    actorEmail,
  });

  return correlatedJson(correlationId, {
    productId: result.data.productId,
    storefrontInvalidation: invalidation.ok ? "ok" : invalidation.error,
    mutationClassification: classification,
    stripeCatalogSync: stripeSync,
  });
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
  const beforeDetail = await fetchCatalogProductDetail(productId).catch(
    () => null,
  );

  const actorEmail = session.user.email?.trim();
  let stripeCatalogArchive: { state: string; reason?: string } = {
    state: "unavailable",
  };
  const supForProjection = adminSupabaseOr503(correlationId);
  if ("client" in supForProjection) {
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
    if (hasStripeArtifacts) {
      const token = process.env.MEDUSA_INTERNAL_ADMIN_TOKEN?.trim();
      const organization = actorEmail
        ? await resolveStaffOrganization(supForProjection.client, actorEmail)
        : null;
      const { data: nangoConnection } = organization
        ? await supForProjection.client
            .from("payment_nango_connections")
            .select("nango_connection_id,provider_config_key")
            .eq("organization_id", organization.id)
            .eq("provider", "stripe")
            .eq("active", true)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : { data: null };
      if (!token) {
        return correlatedJson(
          correlationId,
          {
            error: "Provider-backed products require Stripe archival before deletion",
            code: "CATALOG_PROVIDER_ARCHIVE_UNAVAILABLE",
          },
          { status: 503 },
        );
      }
      const response = await medusaAdminFetch("/admin/catalog/provider-sync", {
        method: "DELETE",
        headers: { "x-uvs-internal-token": token },
        body: JSON.stringify({
          productExternalId: stripe.get("product"),
          priceExternalId: stripe.get("price"),
          paymentLinkExternalId: stripe.get("payment_link"),
          ...(nangoConnection?.nango_connection_id
            ? {
                nango_connection_id: nangoConnection.nango_connection_id,
                nango_provider_config_key: nangoConnection.provider_config_key,
              }
            : {}),
        }),
      });
      if (!response.ok) {
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

  const ops = createMedusaCatalogOperations();
  const result = await ops.deleteProduct(productId);
  if (!result.ok) {
    return jsonFromAdminOperationResult(correlationId, result, 502);
  }

  if (actorEmail) {
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
      before: beforeDetail,
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
    deleted: result.data.deleted,
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
