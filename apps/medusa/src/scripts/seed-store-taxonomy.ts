import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

const STORE_PRODUCT_TYPES = [
  "Guitar",
  "Electric Guitar",
  "Acoustic Guitar",
  "Bass Guitar",
  "Piano",
  "Digital Piano",
  "Keyboard",
  "Drum Kit",
  "Percussion",
  "Amplifier",
  "Effects Pedal",
  "Accessories & Gear",
  "Merchandise",
] ;

const STORE_PRODUCT_TAGS = [
  "New Arrival",
  "Best Seller",
  "Pro Series",
  "Student Friendly",
  "Bundle",
  "Stage Ready",
  "Home Studio",
  "Limited Run",
] ;

const normalize = (value) => value.trim().toLowerCase();

export async function seedStoreTaxonomy(container) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productModuleService = container.resolve(Modules.PRODUCT);

  const existingTypes = await productModuleService.listProductTypes(
    {},
    { take: 1000 },
  );
  const existingTags = await productModuleService.listProductTags(
    {},
    { take: 1000 },
  );

  const productTypeIdsByValue = new Map(
    existingTypes.map((entry) => [normalize(entry.value), entry.id]),
  );
  const productTagIdsByValue = new Map(
    existingTags.map((entry) => [normalize(entry.value), entry.id]),
  );
  const {
    createProductTagsWorkflow,
    createProductTypesWorkflow,
  } = await import("@medusajs/medusa/core-flows");

  const missingTypes = STORE_PRODUCT_TYPES.filter(
    (value) => !productTypeIdsByValue.has(normalize(value)),
  );
  if (missingTypes.length > 0) {
    await createProductTypesWorkflow(container).run({
      input: {
        product_types: missingTypes.map((value) => ({ value })),
      },
    });
    const refreshedTypes = await productModuleService.listProductTypes(
      {},
      { take: 1000 },
    );
    productTypeIdsByValue.clear();
    for (const entry of refreshedTypes) {
      productTypeIdsByValue.set(normalize(entry.value), entry.id);
    }
    logger.info(`Seeded product types: ${missingTypes.join(", ")}`);
  }

  const missingTags = STORE_PRODUCT_TAGS.filter(
    (value) => !productTagIdsByValue.has(normalize(value)),
  );
  if (missingTags.length > 0) {
    await createProductTagsWorkflow(container).run({
      input: {
        product_tags: missingTags.map((value) => ({ value })),
      },
    });
    const refreshedTags = await productModuleService.listProductTags(
      {},
      { take: 1000 },
    );
    productTagIdsByValue.clear();
    for (const entry of refreshedTags) {
      productTagIdsByValue.set(normalize(entry.value), entry.id);
    }
    logger.info(`Seeded product tags: ${missingTags.join(", ")}`);
  }

  return { productTypeIdsByValue, productTagIdsByValue };
}
