import { logAdminApiEvent } from "@/lib/admin-api-log";
import { getCorrelationId } from "@/lib/request-correlation";
import {
  getMedusaRegionId,
  getMedusaStoreSdk,
  optionRowsToSizeColor,
  resolvePosProductImageUrl,
  variantPricePhpFromCalculated,
  withSalesChannelId,
} from "@/lib/medusa-pos";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { correlatedJson, tagResponse } from "@/lib/staff-api-response";

export async function GET(req: Request) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("pos:use");
  if (!staff.ok) {
    return tagResponse(staff.response, correlationId);
  }

  const regionId = getMedusaRegionId();
  const storeSdk = getMedusaStoreSdk();
  if (!regionId || !storeSdk) {
    return correlatedJson(
      correlationId,
      {
        error:
          "POS environment incomplete (NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY, MEDUSA_REGION_ID)",
      },
      { status: 503 },
    );
  }

  try {
    const { products } = await storeSdk.store.product.list(
      withSalesChannelId({
        region_id: regionId,
        limit: 12,
        fields:
          "*variants,*variants.calculated_price,*variants.options,*variants.sku,*variants.barcode,+title,+thumbnail,*images",
      }) as Parameters<typeof storeSdk.store.product.list>[0],
    );

    const suggestions: Array<{
      variantId: string;
      name: string;
      sku: string;
      barcode?: string;
      size: string;
      color: string;
      price: number;
      imageUrl?: string;
    }> = [];

    for (const p of products ?? []) {
      for (const v of p.variants ?? []) {
        if (!v?.id) continue;
        const { size, color } = optionRowsToSizeColor(
          v.options as Parameters<typeof optionRowsToSizeColor>[0],
        );
        const vb = v as { barcode?: string | null; ean?: string | null };
        const barcode =
          String(vb.ean ?? "").trim() || String(vb.barcode ?? "").trim();
        suggestions.push({
          variantId: v.id,
          name: p.title ?? "",
          sku: String(v.sku ?? ""),
          barcode: barcode || undefined,
          size,
          color,
          price: variantPricePhpFromCalculated(v.calculated_price),
          imageUrl: resolvePosProductImageUrl(p),
        });
        if (suggestions.length >= 8) break;
      }
      if (suggestions.length >= 8) break;
    }

    logAdminApiEvent({
      route: "GET /api/pos/medusa/suggestions",
      correlationId,
      phase: "ok",
      detail: { count: suggestions.length },
    });

    return correlatedJson(correlationId, { suggestions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Suggestions unavailable";
    return correlatedJson(correlationId, { error: msg }, { status: 502 });
  }
}
