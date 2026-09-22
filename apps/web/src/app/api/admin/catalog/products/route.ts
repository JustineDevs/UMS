import { staffSessionAllows } from "@universal-music-store/database";
import { getStaffSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { parseOptionalStockQuantity } from "@/lib/parse-optional-stock-quantity";
import {
  parseStorefrontMetadataFromBody,
  parseVariantBarcodeFromBody,
  catalogProductRequestSchema,
} from "@/lib/parse-catalog-product-body";
import { parseAdminJson } from "@/lib/admin-api-security";
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
import { catalogSyncIdempotencyKey } from "@/lib/catalog-sync-idempotency";
import {
  createWorkerCatalogProductForAdmin,
  fetchWorkerCatalogProductDetailForAdmin,
  syncWorkerCatalogProviderForAdmin,
} from "@/lib/worker-admin-bridge";
import { mapWorkerCatalogProductDetail } from "@/lib/catalog-product-service";
import { readResponseJson } from "@/lib/read-response-json";
import { adminCatalogProductMutationResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

async function syncStripeCatalogAfterCreate(input: {
  productId: string;
  title: string;
  description?: string;
  handle?: string;
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
    operation: "create",
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
  } catch (error) {
    console.error("[admin/catalog/products] Stripe catalog synchronization failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return {
      state: "failed" as const,
      reason: "Stripe catalog synchronization failed",
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
    const response = await createWorkerCatalogProductForAdmin({
      idempotencyKey,
      body: { ...body, imageUrls, categoryIds, stockQuantity: stockParsed.value, variantBarcode, storefrontMetadata },
    });
    if (!response) return correlatedJson(correlationId, { error: "Commerce Worker is unavailable" }, { status: 503 });
    const payload = await readResponseJson<{ productId?: string; error?: string; code?: string }>(response, {});
    if (!response.ok || !payload.productId) {
      return correlatedJson(correlationId, { error: payload.error ?? "Product creation failed" }, { status: response.status });
    }
    const workerResult = { ok: true as const, data: { productId: payload.productId } };
    const actorEmail = session.user.email?.trim();
    const stripeSync = await syncStripeCatalogAfterCreate({ productId: payload.productId, title, description: typeof body.description === "string" ? body.description : undefined, handle: typeof body.handle === "string" ? body.handle : undefined, pricePhp });
    const after = mapWorkerCatalogProductDetail(await fetchWorkerCatalogProductDetailForAdmin(payload.productId));
    const classification = classifyCatalogMutation(null, after);
    const invalidation = await notifyStorefrontCommerceInvalidation(buildStorefrontCommerceInvalidationPayload({ classification, after, actorEmail, reason: "A catalog product was created." }));
    const output = adminCatalogProductMutationResponseSchema.safeParse({ productId: workerResult.data.productId, mutationClassification: classification, stripeCatalogSync: stripeSync, storefrontInvalidation: invalidation.ok ? "ok" : invalidation.error });
    if (!output.success) return correlatedJson(correlationId, { error: "Catalog product response validation failed" }, { status: 502 });
    return correlatedJson(correlationId, output.data, { status: 201 });
  }

  return correlatedJson(correlationId, { error: "Commerce Worker is not configured" }, { status: 503 });
}

export const POST = post;
