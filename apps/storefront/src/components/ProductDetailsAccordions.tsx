"use client";

import Link from "next/link";
import type { Product } from "@universal-music-store/types";
import { useProductVariant } from "@/components/ProductVariantProvider";

type Props = {
  product: Product;
  typeRun: string[];
};

function compareHref(product: Product): string {
  const params = new URLSearchParams();
  if (product.category?.trim()) params.set("category", product.category.trim());
  if (product.brand?.trim()) params.set("brand", product.brand.trim());
  const primaryType = product.variants.find((v) => v.type.trim())?.type?.trim();
  if (primaryType) params.set("type", primaryType);
  return `/shop${params.toString() ? `?${params.toString()}` : ""}`;
}

/**
 * PDP collapsible sections for instrument details, specs, build notes, and support.
 */
export function ProductDetailsAccordions({ product, typeRun }: Props) {
  const { variant } = useProductVariant();
  const compareHrefValue = compareHref(product);

  return (
    <div className="space-y-0">
      <details className="group border-b border-outline-variant/20 py-5" data-pdp-section="overview" open>
        <summary className="flex cursor-pointer list-none items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-wider">
            Instrument overview
          </span>
          <span className="material-symbols-outlined transition-transform group-open:rotate-180">
            expand_more
          </span>
        </summary>
        <div className="space-y-3 pt-4 font-body text-sm leading-relaxed text-on-surface-variant">
          <p>
            <strong>In-stock types:</strong>{" "}
            {variant?.type || (typeRun.length ? typeRun.join(" · ") : "See variants above.")}
          </p>
          <p>
            Use the compare link to check nearby models in the same brand or
            category. If you need confirmation on dimensions, pickup layout, or
            shipping lead time, check the spec table below before checking out.
          </p>
          <p>
            <Link href={compareHrefValue} className="text-primary underline">
              Compare similar instruments
            </Link>
          </p>
        </div>
      </details>

      {product.description ? (
        <details className="group border-b border-outline-variant/20 py-5" data-pdp-section="description" open>
          <summary className="flex cursor-pointer list-none items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-wider">
              Description
            </span>
            <span className="material-symbols-outlined transition-transform group-open:rotate-180">
              expand_more
            </span>
          </summary>
          <div className="pt-4 font-body text-sm leading-relaxed text-on-surface-variant">
            {product.description}
          </div>
        </details>
      ) : null}

      <details className="group border-b border-outline-variant/20 py-5" data-pdp-section="build">
        <summary className="flex cursor-pointer list-none items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-wider">
            Build notes
          </span>
          <span className="material-symbols-outlined transition-transform group-open:rotate-180">
            expand_more
          </span>
        </summary>
        <div className="space-y-3 pt-4 font-body text-sm leading-relaxed text-on-surface-variant">
          {product.material?.trim() ? (
            <p>
              <strong>Body / build notes:</strong> {product.material.trim()}
            </p>
          ) : (
            <p>
              Body wood, neck profile, and hardware notes appear in the product
              metadata when provided.
            </p>
          )}
          <p>
            {product.status === "published"
              ? "This instrument is published and available for live checkout when stock allows."
              : "This instrument is not yet published."}
          </p>
        </div>
      </details>

      <details className="group py-5" data-pdp-section="shipping">
        <summary className="flex cursor-pointer list-none items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-wider">
            Shipping &amp; returns
          </span>
          <span className="material-symbols-outlined transition-transform group-open:rotate-180">
            expand_more
          </span>
        </summary>
        <div className="space-y-3 pt-4 font-body text-sm leading-relaxed text-on-surface-variant">
          <p>
            We ship nationwide through courier partners and show the best
            available delivery option at checkout. For high-value instruments,
            please keep the unboxing video and packaging until setup is
            confirmed.
          </p>
          <p>
            <Link href="/shipping" className="text-primary underline">
              Shipping
            </Link>
            {" · "}
            <Link href="/returns" className="text-primary underline">
              Returns &amp; exchanges
            </Link>
            {" · "}
            <Link href="/warranty" className="text-primary underline">
              Warranty
            </Link>
          </p>
        </div>
      </details>
    </div>
  );
}

/** Renders specifications separately without duplicating the details stack. */
export function ProductSpecifications({ product }: Pick<Props, "product">) {
  const { variant } = useProductVariant();
  const selected = variant ?? product.variants[0];
  const value = (key: keyof NonNullable<typeof selected>) =>
    typeof selected?.[key] === "string" ? selected[key].trim() : "";
  const compareHrefValue = compareHref(product);
  const guitarSpecs = product.guitarSpecs;
  const guitarRows: Array<[string, string]> = guitarSpecs
    ? [
        ["Body shape", guitarSpecs.bodyShape],
        ["Body top", guitarSpecs.bodyTop],
        ["Back and sides", guitarSpecs.bodyBackAndSides],
        ["Neck", guitarSpecs.neckMaterial],
        ["Neck profile", guitarSpecs.neckProfile],
        ["Scale length", guitarSpecs.scaleLengthMm != null ? `${guitarSpecs.scaleLengthMm} mm` : ""],
        ["Nut width", guitarSpecs.nutWidthMm != null ? `${guitarSpecs.nutWidthMm} mm` : ""],
        ["Frets", guitarSpecs.fretCount != null ? String(guitarSpecs.fretCount) : ""],
        ["Fingerboard", guitarSpecs.fingerboardMaterial],
        ["Bridge", guitarSpecs.bridge],
        ["Tuners", guitarSpecs.tuners],
        ["Electronics", guitarSpecs.electronics],
        ["Controls", guitarSpecs.controls],
        ["Strings", guitarSpecs.strings],
        ["Case included", guitarSpecs.caseIncluded == null ? "" : guitarSpecs.caseIncluded ? "Yes" : "No"],
        ["Setup included", guitarSpecs.setupIncluded == null ? "" : guitarSpecs.setupIncluded ? "Yes" : "No"],
        ["Warranty", guitarSpecs.warranty],
        ["Included accessories", guitarSpecs.includedAccessories?.join(" · ") ?? ""],
      ].filter(([, value]) => Boolean(value)) as Array<[string, string]>
    : [];

  return (
    <details className="group py-5" data-pdp-section="specifications" open>
      <summary className="flex cursor-pointer list-none items-center justify-between">
        <span className="text-sm font-bold uppercase tracking-wider">Specifications</span>
        <span className="material-symbols-outlined transition-transform group-open:rotate-180">
          expand_more
        </span>
      </summary>
      <div className="pt-4">
        <div className="overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-low/30">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-outline-variant/10">
              {[
                ["Brand", product.brand?.trim() || "Not listed"],
                ["Instrument type", value("type") || "Not listed"],
                ["Finish", value("finish") || "Not listed"],
                ["Pickup config", value("pickupConfig") || "Not listed"],
                ["Body wood", value("bodyWood") || "Not listed"],
                ["Condition", value("condition") || "Not listed"],
                ["Skill level", value("skillLevel") || "Not listed"],
                ["Shipping speed", value("shippingSpeed") || "Not listed"],
                ...(product.weightKg != null ? [["Weight", `${product.weightKg} kg`]] : []),
                ...(product.dimensionsLabel?.trim()
                  ? [["Dimensions", product.dimensionsLabel.trim()]]
                  : []),
                ...guitarRows,
              ].map(([label, value]) => (
                <tr key={label}>
                  <th className="w-44 px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    {label}
                  </th>
                  <td className="px-4 py-3 text-on-surface">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <Link
            href={compareHrefValue}
            className="rounded-full border border-outline-variant/30 px-3 py-1.5 font-medium text-primary hover:bg-primary hover:text-on-primary"
          >
            Compare similar
          </Link>
          <Link
            href="/shop"
            className="rounded-full border border-outline-variant/30 px-3 py-1.5 font-medium text-on-surface-variant hover:text-primary"
          >
            Back to catalog
          </Link>
        </div>
      </div>
    </details>
  );
}
