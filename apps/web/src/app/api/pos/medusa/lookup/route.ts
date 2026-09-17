import { NextResponse } from "next/server";
import { logAdminApiEvent } from "@/lib/admin-api-log";
import { getCorrelationId } from "@/lib/request-correlation";
import {
  type ProductThumbSource,
  getMedusaAdminSdk,
  getMedusaRegionId,
  getMedusaStoreSdk,
  optionRowsToSizeColor,
  resolvePosProductImageUrl,
  variantPricePhpFromCalculated,
  withSalesChannelId,
} from "@/lib/medusa-pos";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { parseBoundedJson } from "@/lib/bounded-request-body";

export async function POST(req: Request) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("pos:use");
  if (!staff.ok) {
    return tagResponse(staff.response, correlationId);
  }
  logAdminApiEvent({
    route: "POST /api/pos/medusa/lookup",
    correlationId,
    phase: "start",
  });

  const parsedBody = await parseBoundedJson(req, 16 * 1024);
  if (parsedBody.tooLarge) return correlatedJson(correlationId, { error: "Payload too large" }, { status: 413 });
  const body = (parsedBody.valid ? parsedBody.value : {}) as {
    barcode?: string;
    sku?: string;
  };
  const barcode = typeof body.barcode === "string" ? body.barcode.trim() : "";
  const sku = typeof body.sku === "string" ? body.sku.trim() : "";
  const trimmed = barcode || sku;
  if (!trimmed) {
    return correlatedJson(
      correlationId,
      { error: "Missing barcode or sku" },
      { status: 400 },
    );
  }

  const regionId = getMedusaRegionId();
  const storeSdk = getMedusaStoreSdk();
  const adminSdk = getMedusaAdminSdk();
  if (!regionId || !storeSdk || !adminSdk) {
    return correlatedJson(
      correlationId,
      {
        error:
          "POS environment incomplete (NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY, MEDUSA_REGION_ID, MEDUSA_SECRET_API_KEY)",
      },
      { status: 503 },
    );
  }

  type VariantLike = {
    id?: string;
    sku?: string | null;
    calculated_price?: { calculated_amount?: number | null } | null;
    options?: Array<{ option?: { title?: string | null } | null; value?: string | null }>;
    product?: { title?: string | null; id?: string | null };
    product_id?: string | null;
  };

  let variant: VariantLike | null = null;
  let productTitle = "";
  let thumbSource: ProductThumbSource | undefined;

  try {
    const storeList = await storeSdk.store.product.list(
      withSalesChannelId({
        region_id: regionId,
        q: trimmed,
        limit: 50,
        fields:
          "*variants,*variants.calculated_price,*variants.options,*variants.sku,*variants.barcode,+title,+thumbnail,*images",
      }) as Parameters<typeof storeSdk.store.product.list>[0],
    );
    outerStore: for (const p of storeList.products ?? []) {
      for (const v of p.variants ?? []) {
        const vSku = String(v.sku ?? "").trim();
        const ext = v as VariantLike & { ean?: string; barcode?: string };
        const barcodeMatch =
          String(ext.ean ?? "").trim() === trimmed ||
          String(ext.barcode ?? "").trim() === trimmed;
        if (vSku === trimmed || barcodeMatch) {
          variant = v as VariantLike;
          productTitle = p.title ?? "";
          thumbSource = p;
          break outerStore;
        }
      }
    }
  } catch {
    /* try admin */
  }

  if (!variant) {
    try {
      const adminProducts = await adminSdk.admin.product.list({
        q: trimmed,
        limit: 25,
        fields:
          "+variants.id,+variants.sku,+variants.barcode,+variants.options.*,+title",
      });
      outerAdmin: for (const p of adminProducts.products ?? []) {
        const variants = p.variants ?? [];
        const exact = variants.find(
          (x) => String(x.sku ?? "").trim() === trimmed,
        );
        const pick = exact ?? variants[0];
        const pid = p.id;
        if (pick?.id && pid) {
          const prod = await storeSdk.store.product.retrieve(
            pid,
            withSalesChannelId({
              region_id: regionId,
              fields:
                "*variants,*variants.calculated_price,*variants.options,*variants.sku,*variants.barcode,+title,+thumbnail,*images",
            }) as Parameters<typeof storeSdk.store.product.retrieve>[1],
          );
          const vmatch = prod.product?.variants?.find((x) => x.id === pick.id);
          variant = (vmatch ?? pick) as VariantLike;
          productTitle = prod.product?.title ?? p.title ?? "";
          thumbSource = prod.product ?? thumbSource;
          break outerAdmin;
        }
      }
    } catch {
      /* not found */
    }
  }

  if (!variant?.id) {
    logAdminApiEvent({
      route: "POST /api/pos/medusa/lookup",
      correlationId,
      phase: "error",
      detail: { reason: "not_found" },
    });
    return tagResponse(new NextResponse(null, { status: 404 }), correlationId);
  }

  const { size, color } = optionRowsToSizeColor(variant.options);
  const price = variantPricePhpFromCalculated(variant.calculated_price);
  const ext = variant as { barcode?: string | null; ean?: string | null };
  const barcodeRaw =
    String(ext.ean ?? "").trim() || String(ext.barcode ?? "").trim();

  logAdminApiEvent({
    route: "POST /api/pos/medusa/lookup",
    correlationId,
    phase: "ok",
    detail: { variantId: variant.id },
  });

  return correlatedJson(correlationId, {
    id: variant.id,
    sku: String(variant.sku ?? ""),
    barcode: barcodeRaw || undefined,
    size,
    color,
    price,
    products: { name: productTitle },
    imageUrl: resolvePosProductImageUrl(thumbSource),
  });
}
