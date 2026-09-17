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

const DEFAULT_LIMIT = 24;

export async function GET(req: Request) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("pos:use");
  if (!staff.ok) {
    return tagResponse(staff.response, correlationId);
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) {
    return correlatedJson(correlationId, { products: [] });
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

  logAdminApiEvent({
    route: "GET /api/pos/medusa/search",
    correlationId,
    phase: "start",
  });

  try {
    const { products } = await storeSdk.store.product.list(
      withSalesChannelId({
        region_id: regionId,
        q,
        limit: DEFAULT_LIMIT,
        fields:
          "*variants,*variants.calculated_price,*variants.options,*variants.sku,*variants.barcode,+title,+thumbnail,*images",
      }) as Parameters<typeof storeSdk.store.product.list>[0],
    );

    const list: Array<{
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
        list.push({
          variantId: v.id,
          name: p.title ?? "",
          sku: String(v.sku ?? ""),
          barcode: barcode || undefined,
          size,
          color,
          price: variantPricePhpFromCalculated(v.calculated_price),
          imageUrl: resolvePosProductImageUrl(p),
        });
      }
    }

    logAdminApiEvent({
      route: "GET /api/pos/medusa/search",
      correlationId,
      phase: "ok",
      detail: { count: list.length },
    });

    return correlatedJson(correlationId, { products: list });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Product search unavailable";
    logAdminApiEvent({
      route: "GET /api/pos/medusa/search",
      correlationId,
      phase: "error",
      detail: { message: msg },
    });
    return correlatedJson(correlationId, { error: msg }, { status: 502 });
  }
}
