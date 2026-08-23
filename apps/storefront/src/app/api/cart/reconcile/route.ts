import { z } from "zod";
import { fetchProductById } from "@/lib/catalog-medusa-fetch";
import { applyRateLimit } from "@/lib/cart-api-helpers";
import { calculateReconciledCartTotal } from "@/lib/cart";
import { fetchMedusaAdminVariant } from "@/lib/medusa-admin-variant";
import { canonicalProductIdFromAdminVariant } from "@/lib/cart-reconcile-identity";
import { availableQuantityFromVariantRaw } from "@universal-music-store/validation";
import { isSameOriginMutation } from "@/lib/request-origin";
import { parseBoundedJson } from "@/lib/bounded-request-body";

export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    lines: z
      .array(
        z
          .object({
            variantId: z.string().trim().min(1).max(200),
            quantity: z.number().int().min(1).max(999),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return Response.json(
      { error: "Cross-site mutation rejected" },
      { status: 403 },
    );
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 64 * 1024) {
    return Response.json({ error: "Request body too large" }, { status: 413 });
  }
  const rateLimit = await applyRateLimit(request, "cart-reconcile", 30, 60_000);
  if (!rateLimit.ok) return rateLimit.response;

  const bounded = await parseBoundedJson(request, 64 * 1024);
  if (bounded.tooLarge) {
    return Response.json({ error: "Request body too large" }, { status: 413 });
  }
  const parsed = requestSchema.safeParse(bounded.valid ? bounded.value : null);
  if (!parsed.success)
    return Response.json({ error: "Invalid cart lines" }, { status: 400 });

  const resolved = await Promise.all(
    parsed.data.lines.map(async (line) => {
      const inventoryVariant = await fetchMedusaAdminVariant(
        line.variantId,
      ).catch(() => null);
      // The Admin variant lookup is the canonical identity boundary. A missing
      // result means the variant is unavailable or the authority is unhealthy;
      // never fall back to client-supplied slug metadata.
      if (!inventoryVariant) {
        return { variantId: line.variantId, status: "error" as const };
      }
      const canonicalProductId =
        canonicalProductIdFromAdminVariant(inventoryVariant);
      if (!canonicalProductId) {
        return { variantId: line.variantId, status: "error" as const };
      }
      const product = await fetchProductById(canonicalProductId);
      if (
        product.kind === "service_error" ||
        product.kind === "misconfigured"
      ) {
        return { variantId: line.variantId, status: "error" as const };
      }
      if (product.kind !== "ok")
        return { variantId: line.variantId, status: "unavailable" as const };
      const variant = product.product.variants.find(
        (item) => item.id === line.variantId,
      );
      if (!variant || !variant.isActive) {
        return { variantId: line.variantId, status: "unavailable" as const };
      }
      let availableQuantity: number | null = null;
      if (variant.manageInventory) {
        if (!inventoryVariant) {
          return { variantId: line.variantId, status: "error" as const };
        }
        availableQuantity = Math.floor(
          availableQuantityFromVariantRaw(inventoryVariant),
        );
      }
      if (availableQuantity !== null && availableQuantity < 1) {
        return { variantId: line.variantId, status: "unavailable" as const };
      }
      const overLimit =
        availableQuantity !== null && line.quantity > availableQuantity;
      return {
        variantId: variant.id,
        // Preserve the shopper's requested quantity. Checkout remains authoritative
        // and rejects stale stock instead of silently changing the bag.
        quantity: line.quantity,
        slug: product.product.slug,
        name: product.product.name,
        sku: variant.sku,
        type: variant.type,
        finish: variant.finish,
        price: variant.price,
        currencyCode: variant.currencyCode ?? "PHP",
        thumbnail: product.product.images[0]?.imageUrl,
        availableQuantity,
        status: overLimit ? ("over_limit" as const) : ("current" as const),
      };
    }),
  );

  const json = (body: unknown, status = 200) =>
    Response.json(body, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });

  if (resolved.some((line) => line.status === "error")) {
    return json(
      {
        error: "Catalog reconciliation is temporarily unavailable",
        lines: resolved.map(({ variantId, status }) => ({ variantId, status })),
      },
      503,
    );
  }

  return json({
    ok: true,
    reconciledAt: new Date().toISOString(),
    lines: resolved,
    currency:
      resolved.find((line) => typeof line.currencyCode === "string")
        ?.currencyCode ?? "PHP",
    cartTotal: calculateReconciledCartTotal(resolved),
  });
}
