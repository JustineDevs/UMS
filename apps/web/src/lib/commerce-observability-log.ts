import type { StorefrontCatalogMutationClassification } from "@/lib/storefront-commerce-invalidation";

/**
 * Structured stdout line for admin commerce mutations (ops / log aggregation).
 */
export function logAdminCatalogMutationClassified(input: {
  classification: StorefrontCatalogMutationClassification;
  productId: string;
  correlationId?: string;
  actorEmail?: string | null;
}): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      source: "admin_server",
      event: "admin_catalog_mutation_classified",
      classification: input.classification,
      productId: input.productId,
      correlationId: input.correlationId ?? null,
      actorEmail: input.actorEmail?.trim().toLowerCase() ?? null,
    }),
  );
}
