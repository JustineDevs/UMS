/**
 * Application-layer catalog contract. Infrastructure: Medusa Admin SDK.
 */
import type { AdminOperationResult } from "@/lib/admin-operation-result";
import {
  createCatalogProduct,
  deleteCatalogProduct,
  updateCatalogProduct,
  type CreateCatalogProductBody,
  type UpdateCatalogProductBody,
} from "@/lib/catalog-product-mutations";

export type CatalogOperations = {
  createProduct(
    _body: CreateCatalogProductBody,
  ): Promise<AdminOperationResult<{ productId: string }>>;
  updateProduct(
    _productId: string,
    _body: UpdateCatalogProductBody,
  ): Promise<AdminOperationResult<{ productId: string }>>;
  deleteProduct(
    _productId: string,
  ): Promise<AdminOperationResult<{ deleted: boolean }>>;
};

export function createMedusaCatalogOperations(): CatalogOperations {
  return {
    createProduct: createCatalogProduct,
    updateProduct: updateCatalogProduct,
    deleteProduct: deleteCatalogProduct,
  };
}
