import type { SupabaseClient } from "@supabase/supabase-js";

export type CatalogStockAuditReferenceType =
  | "catalog_product_create"
  | "catalog_product_update";

export type CatalogStockAuditContext = {
  supabase: SupabaseClient;
  actorEmail: string | null;
  correlationId: string;
  referenceType: CatalogStockAuditReferenceType;
};
