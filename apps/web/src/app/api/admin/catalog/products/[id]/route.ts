import { staffSessionAllows } from "@universal-music-store/database";
import { getStaffSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
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
import { mapWorkerCatalogProductDetail } from "@/lib/catalog-product-service";
import { correlatedJson } from "@/lib/staff-api-response";
import {
  classifyCatalogMutation,
  buildStorefrontCommerceInvalidationPayload,
  notifyStorefrontCommerceInvalidation,
} from "@/lib/storefront-commerce-invalidation";
import {
  stripeAvailableForMerchant,
  STRIPE_UNAVAILABLE_IN_MERCHANT_COUNTRY,
} from "@/lib/payment-country-policy";
import { readResponseJson } from "@/lib/read-response-json";
import { catalogSyncIdempotencyKey } from "@/lib/catalog-sync-idempotency";
import {
  deleteWorkerCatalogProductForAdmin,
  fetchWorkerCatalogProductDetailForAdmin,
  syncWorkerCatalogProviderForAdmin,
  updateWorkerCatalogProductForAdmin,
} from "@/lib/worker-admin-bridge";
import { adminCatalogProductDeleteResponseSchema, adminCatalogProductMutationResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

async function syncStripeCatalogAfterUpdate(input: {
  productId: string;
  title: string;
  description?: string | null;
  handle?: string | null;
  pricePhp: number;
}) {
  if (!stripeAvailableForMerchant())
    return {
      state: "unavailable" as const,
      reason: STRIPE_UNAVAILABLE_IN_MERCHANT_COUNTRY,
    };
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
      },
    });
    if (!response) return { state: "unavailable" as const, reason: "WORKER_NOT_CONFIGURED" };
    const payload = await readResponseJson<{
      data?: {
        productId?: string;
        priceId?: string;
        paymentLinkId?: string;
        paymentLinkUrl?: string;
      };
      error?: string;
      code?: string;
    }>(response, {});
    if (!response.ok || !payload.data?.productId || !payload.data.priceId) {
      return {
        state: "failed" as const,
        reason: payload.error ?? "Stripe catalog synchronization failed",
      };
    }
    return {
      state: "synced" as const,
      paymentLinkUrl: payload.data.paymentLinkUrl ?? null,
    };
  } catch {
    return {
      state: "failed" as const,
      reason: "Stripe catalog synchronization failed",
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

  if (process.env.API_URL?.trim()) {
    const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
    if (!idempotencyKey) return correlatedJson(correlationId, { error: "Idempotency-Key is required" }, { status: 400 });
    const beforeMapped = mapWorkerCatalogProductDetail(await fetchWorkerCatalogProductDetailForAdmin(productId).catch(() => null));
    const response = await updateWorkerCatalogProductForAdmin({ productId, idempotencyKey, body: { ...body, imageUrls, categoryIds, sizeLabels: sizeLabelsArr, colorLabels: colorLabelsArr, stockQuantity: stockParsed.value, variantStocks: variantStocksParsed.value, matrixCellStocks: matrixCellStocksParsed.value, variantBarcode, storefrontMetadata } });
    if (!response) return correlatedJson(correlationId, { error: "Commerce Worker is unavailable" }, { status: 503 });
    const payload = await readResponseJson<{ productId?: string; error?: string }>(response, {});
    if (!response.ok || !payload.productId) return correlatedJson(correlationId, { error: payload.error ?? "Product update failed" }, { status: response.status });
    const actorEmail = session.user.email?.trim();
    const stripeSync = await syncStripeCatalogAfterUpdate({ productId, title, description: typeof body.description === "string" ? body.description : null, handle, pricePhp });
    const afterMapped = mapWorkerCatalogProductDetail(await fetchWorkerCatalogProductDetailForAdmin(productId).catch(() => null));
    const classification = classifyCatalogMutation(beforeMapped, afterMapped);
    const invalidation = await notifyStorefrontCommerceInvalidation(buildStorefrontCommerceInvalidationPayload({ classification, before: beforeMapped, after: afterMapped, actorEmail, reason: "A catalog product was updated." }));
    const output = adminCatalogProductMutationResponseSchema.safeParse({ productId, mutationClassification: classification, stripeCatalogSync: stripeSync, storefrontInvalidation: invalidation.ok ? "ok" : invalidation.error });
    if (!output.success) return correlatedJson(correlationId, { error: "Catalog product response validation failed" }, { status: 502 });
    return correlatedJson(correlationId, output.data);
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
  const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey) {
    return correlatedJson(correlationId, { error: "Idempotency-Key is required", code: "IDEMPOTENCY_KEY_REQUIRED" }, { status: 400 });
  }
  if (process.env.API_URL?.trim()) {
    const response = await deleteWorkerCatalogProductForAdmin({ productId, idempotencyKey });
    if (!response) return correlatedJson(correlationId, { error: "Commerce Worker is unavailable" }, { status: 503 });
    const payload = await readResponseJson<{
      deleted?: boolean;
      error?: string;
      stripeCatalogArchive?: { state?: string; reason?: string | null };
    }>(response, {});
    if (!response.ok || payload.deleted !== true) {
      return correlatedJson(correlationId, { error: payload.error ?? "Product deletion failed" }, { status: response.status });
    }
    const stripeCatalogArchive = payload.stripeCatalogArchive ?? { state: "unavailable" };

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

    const output = adminCatalogProductDeleteResponseSchema.safeParse({
      deleted: true,
      mutationClassification:
        beforeDetail?.status === "published"
          ? "sellability_affecting"
          : "editorial_only",
      storefrontInvalidation: invalidation.ok ? "ok" : invalidation.error,
      stripeCatalogArchive,
    });
    if (!output.success) return correlatedJson(correlationId, { error: "Catalog product response validation failed" }, { status: 502 });
    return correlatedJson(correlationId, output.data);
  }
  return correlatedJson(correlationId, { error: "Commerce Worker is not configured" }, { status: 503 });
}

export const PATCH = patch;
export const DELETE = deleteHandler;
