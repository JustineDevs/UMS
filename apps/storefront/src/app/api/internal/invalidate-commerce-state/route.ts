import { NextResponse } from "next/server";
import {
  listOpenPaymentAttempts,
  paymentAttemptMatchesCatalogMutation,
  updatePaymentAttemptByCorrelationId,
} from "@universal-music-store/platform-data";
import { revalidatePath, revalidateTag } from "next/cache";

import {
  buildCommerceInvalidationRevalidationPlan,
  type CommerceInvalidationClassification,
} from "@/lib/commerce-invalidation-plan";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { logCommerceObservabilityServer } from "@/lib/commerce-observability";

export const dynamic = "force-dynamic";

type Body = {
  classification?: string;
  productHandles?: string[];
  productIds?: string[];
  variantIds?: string[];
  /** Medusa category handles (maps to Next cache tag `collection:{handle}`). */
  collectionHandles?: string[];
  actorEmail?: string | null;
  reason?: string;
};

function normalizeStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))].sort();
}

function rowMissingQuoteMetadata(row: {
  provider_payload?: Record<string, unknown> | null;
}): boolean {
  const payload =
    row.provider_payload && typeof row.provider_payload === "object"
      ? (row.provider_payload as Record<string, unknown>)
      : {};
  const quote =
    payload.quote && typeof payload.quote === "object"
      ? (payload.quote as Record<string, unknown>)
      : {};
  const variantIds = Array.isArray(quote.variant_ids) ? quote.variant_ids : [];
  const productIds = Array.isArray(quote.product_ids) ? quote.product_ids : [];
  return variantIds.length === 0 && productIds.length === 0;
}

export async function POST(req: Request) {
  /** Playwright sets `__PLAYWRIGHT_*` when repo dotenv clears `STOREFRONT_INTERNAL_INVALIDATION_SECRET`. */
  const configuredSecret =
    process.env.STOREFRONT_INTERNAL_INVALIDATION_SECRET?.trim() ||
    process.env.__PLAYWRIGHT_STOREFRONT_INVALIDATION_SECRET?.trim();
  const providedSecret = req.headers.get("x-internal-secret")?.trim();
  if (!configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const productHandles = normalizeStrings(body.productHandles);
  const productIds = normalizeStrings(body.productIds);
  const variantIds = normalizeStrings(body.variantIds);
  const collectionHandles = normalizeStrings(body.collectionHandles).map((h) =>
    h.toLowerCase(),
  );
  const classificationRaw = body.classification;
  const classification: CommerceInvalidationClassification =
    classificationRaw === "editorial_only" ||
    classificationRaw === "merchandising_only"
      ? classificationRaw
      : classificationRaw === "sellability_affecting"
        ? "sellability_affecting"
        : "checkout_affecting";
  const actorEmail = typeof body.actorEmail === "string" ? body.actorEmail.trim() : "";
  const staleReason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : "Your order changed after a catalog update. Review the updated total before continuing.";

  const plan = buildCommerceInvalidationRevalidationPlan({
    productHandles,
    collectionHandlesLowercase: collectionHandles,
    classification,
  });
  const revalidatedTags = new Set(plan.tags);
  const revalidatedPaths = new Set(plan.paths);

  for (const tag of plan.tags) {
    revalidateTag(tag);
  }
  for (const path of plan.paths) {
    revalidatePath(path);
  }

  const expiresOpenPaymentAttempts =
    (classification === "checkout_affecting" ||
      classification === "sellability_affecting") &&
    (variantIds.length > 0 || productIds.length > 0);

  let invalidatedAttempts = 0;
  if (expiresOpenPaymentAttempts) {
    const sb = createStorefrontServiceSupabase();
    if (sb) {
      const rows = await listOpenPaymentAttempts(sb, 200);
      const nowIso = new Date().toISOString();
      for (const row of rows) {
        const legacyRow = rowMissingQuoteMetadata(row);
        if (
          !legacyRow &&
          !paymentAttemptMatchesCatalogMutation(row, { variantIds, productIds })
        ) {
          continue;
        }
        await updatePaymentAttemptByCorrelationId(sb, row.correlation_id, {
          status: "expired",
          checkout_state: "needs_review",
          stale_reason: staleReason,
          invalidated_at: nowIso,
          invalidated_by: actorEmail || "admin_catalog_invalidation",
          last_error: staleReason,
        });
        invalidatedAttempts += 1;
      }
    }
  }

  logCommerceObservabilityServer("storefront_revalidation_triggered", {
    classification,
    productIds,
    variantIds,
    collectionHandles,
    revalidatedTags: [...revalidatedTags],
    revalidatedPaths: [...revalidatedPaths],
    invalidatedAttempts,
    actorEmail: actorEmail || null,
  });

  return NextResponse.json({
    ok: true,
    classification,
    revalidatedTags: [...revalidatedTags],
    revalidatedPaths: [...revalidatedPaths],
    invalidatedAttempts,
  });
}
