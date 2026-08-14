import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createProductCategoriesWorkflow } from "@medusajs/medusa/core-flows";

/**
 * Idempotent: creates default product categories used by the storefront shop filter
 * and admin catalog assignment when they are missing.
 *
 * Aligns with names in `seed.ts` (Guitars, Amplifiers, Effects, Merch).
 */
const DEFAULT_CATEGORY_NAMES = [
  "Guitars",
  "Amplifiers",
  "Effects",
  "Merch",
] as const;

export default async function ensureProductCategories({
  container,
}: ExecArgs): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productModuleService = container.resolve(Modules.PRODUCT);

  let created = 0;

  for (const name of DEFAULT_CATEGORY_NAMES) {
    const existing = await productModuleService.listProductCategories({
      name,
    });
    if (existing.length > 0) {
      continue;
    }
    await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: [
          {
            name,
            is_active: true,
          },
        ],
      },
    });
    created += 1;
    logger.info(`Created product category: ${name}`);
  }

  if (created === 0) {
    logger.info(
      `Product categories: all ${DEFAULT_CATEGORY_NAMES.length} defaults already exist.`,
    );
  } else {
    logger.info(`Product categories: created ${created} missing row(s).`);
  }
}
