import { z } from "zod";
import { fetchProductBySlug } from "@/lib/catalog-medusa-fetch";
import { applyRateLimit } from "@/lib/cart-api-helpers";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  lines: z.array(z.object({
    variantId: z.string().trim().min(1).max(200),
    slug: z.string().trim().min(1).max(200),
    quantity: z.number().int().min(1).max(999),
  }).strict()).max(50),
}).strict();

export async function POST(request: Request) {
  const rateLimit = await applyRateLimit(request, "cart-reconcile", 30, 60_000);
  if (!rateLimit.ok) return rateLimit.response;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid cart lines" }, { status: 400 });

  const resolved = await Promise.all(parsed.data.lines.map(async (line) => {
    const product = await fetchProductBySlug(line.slug);
    if (product.kind === "service_error" || product.kind === "misconfigured") {
      return { variantId: line.variantId, status: "error" as const };
    }
    if (product.kind !== "ok") return { variantId: line.variantId, status: "unavailable" as const };
    const variant = product.product.variants.find((item) => item.id === line.variantId);
    if (!variant || !variant.isActive) {
      return { variantId: line.variantId, status: "unavailable" as const };
    }
    const availableQuantity = variant.manageInventory ? variant.inventoryQuantity : null;
    const quantity = availableQuantity == null
      ? line.quantity
      : Math.min(line.quantity, Math.max(0, availableQuantity));
    if (quantity < 1) return { variantId: line.variantId, status: "unavailable" as const };
    return {
      variantId: variant.id,
      quantity,
      slug: product.product.slug,
      name: product.product.name,
      sku: variant.sku,
      type: variant.type,
      finish: variant.finish,
      price: variant.price,
      thumbnail: product.product.images[0]?.imageUrl,
      availableQuantity,
      status: quantity === line.quantity ? "current" as const : "adjusted" as const,
    };
  }));

  if (resolved.some((line) => line.status === "error")) {
    return Response.json(
      { error: "Catalog reconciliation is temporarily unavailable" },
      { status: 503 },
    );
  }

  return Response.json({ ok: true, lines: resolved });
}
