import type { CartLine } from "@/lib/cart";
import { medusaMinorToMajor } from "@/lib/medusa-money";

type OptRow = { option?: { title?: string } | null; value?: string };

function optionValue(
  options: OptRow[] | null | undefined,
  titleMatch: RegExp,
): string {
  if (!options?.length) return "";
  for (const o of options) {
    const t = (o.option?.title ?? "").toLowerCase();
    if (titleMatch.test(t) && typeof o.value === "string") return o.value;
  }
  return "";
}

/**
 * Maps a Medusa store cart (retrieve) into storefront {@link CartLine} rows for sessionStorage.
 */
export function medusaCartToCartLines(cart: unknown): CartLine[] {
  if (!cart || typeof cart !== "object") return [];
  const c = cart as Record<string, unknown>;
  const currencyCode = typeof c.currency_code === "string" ? c.currency_code : "PHP";
  const items = Array.isArray(c.items) ? c.items : [];
  const out: CartLine[] = [];

  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const it = raw as Record<string, unknown>;
    const variant = it.variant as Record<string, unknown> | undefined;
    const product =
      (variant?.product as Record<string, unknown> | undefined) ??
      (it.product as Record<string, unknown> | undefined);
    const variantId =
      typeof it.variant_id === "string"
        ? it.variant_id
        : typeof variant?.id === "string"
          ? variant.id
          : "";
    if (!variantId) continue;

    const qty =
      typeof it.quantity === "number" && Number.isFinite(it.quantity)
        ? Math.max(1, Math.floor(it.quantity))
        : 1;

    const options = (variant?.options ?? null) as OptRow[] | null;
    const type = optionValue(options, /type|kind|style|size/);
    const finish = optionValue(options, /finish|color|colour/);

    const unitMinor =
      typeof it.unit_price === "number" && Number.isFinite(it.unit_price)
        ? it.unit_price
        : typeof variant?.calculated_price === "object" &&
            variant.calculated_price !== null
          ? Number(
              (variant.calculated_price as { calculated_amount?: number })
                .calculated_amount,
            )
          : 0;
    const priceMajor =
      Number.isFinite(unitMinor) && unitMinor > 0
        ? medusaMinorToMajor(unitMinor, currencyCode)
        : 0;

    const name =
      typeof product?.title === "string"
        ? product.title
        : typeof it.title === "string"
          ? it.title
          : "Item";
    const slug =
      typeof product?.handle === "string" ? product.handle : "item";
    const sku =
      typeof variant?.sku === "string" ? variant.sku : variantId.slice(-8);

    const thumb =
      typeof it.thumbnail === "string" && it.thumbnail.trim()
        ? it.thumbnail.trim()
        : typeof product?.thumbnail === "string" && product.thumbnail.trim()
          ? product.thumbnail.trim()
          : undefined;

    out.push({
      variantId,
      quantity: qty,
      slug,
      name,
      sku,
      type: type || "",
      finish: finish || "",
      price: priceMajor,
      currencyCode: currencyCode.toUpperCase(),
      ...(thumb ? { thumbnail: thumb } : {}),
    });
  }

  return out;
}
