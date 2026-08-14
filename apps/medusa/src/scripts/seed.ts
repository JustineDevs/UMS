import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { ApiKey } from "../../.medusa/types/query-entry-points";
import { seedStoreTaxonomy } from "./seed-store-taxonomy";

type CoreFlowsModule = typeof import("@medusajs/medusa/core-flows");

let coreFlowsModule: CoreFlowsModule | null = null;

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const productModuleService = container.resolve(Modules.PRODUCT);
  const inventoryModuleService = container.resolve(Modules.INVENTORY);
  const regionModuleService = container.resolve(Modules.REGION);
  const taxModuleService = container.resolve(Modules.TAX);
  const stockLocationModuleService = container.resolve(Modules.STOCK_LOCATION);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);
  coreFlowsModule = await import("@medusajs/medusa/core-flows");
  const {
    batchInventoryItemLevelsWorkflow,
    createApiKeysWorkflow,
    createProductCategoriesWorkflow,
    createProductsWorkflow,
    createRegionsWorkflow,
    createSalesChannelsWorkflow,
    createShippingOptionsWorkflow,
    createShippingProfilesWorkflow,
    createStockLocationsWorkflow,
    createTaxRegionsWorkflow,
    linkProductsToSalesChannelWorkflow,
    linkSalesChannelsToApiKeyWorkflow,
    linkSalesChannelsToStockLocationWorkflow,
    updateStoresWorkflow,
  } = coreFlowsModule;
  const updateStoreCurrencies = createWorkflow(
    "update-store-currencies",
    (input: {
      supported_currencies: { currency_code: string; is_default?: boolean }[];
      store_id: string;
    }) => {
      const normalizedInput = transform({ input }, (data) => {
        return {
          selector: { id: data.input.store_id },
          update: {
            supported_currencies: data.input.supported_currencies.map(
              (currency) => {
                return {
                  currency_code: currency.currency_code,
                  is_default: currency.is_default ?? false,
                };
              },
            ),
          },
        };
      });

      const stores = coreFlowsModule!.updateStoresStep(normalizedInput);

      return new WorkflowResponse(stores);
    },
  );

  const countries = ["gb", "de", "dk", "se", "fr", "es", "it"];

  logger.info("Seeding store data...");
  const [store] = await storeModuleService.listStores();
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    // create the default sales channel
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container,
    ).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
          },
        ],
      },
    });
    defaultSalesChannel = salesChannelResult;
  }

  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [
        {
          currency_code: "eur",
          is_default: true,
        },
        {
          currency_code: "usd",
        },
      ],
    },
  });

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  });
  logger.info("Seeding region data...");
  let regions = await regionModuleService.listRegions({ name: "Europe" });
  let region = regions[0];
  if (!region) {
    const { result: regionResult } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Europe",
            currency_code: "eur",
            countries,
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    });
    region = regionResult[0];
  }
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  const existingTaxRegions = await Promise.all(
    countries.map(async (country_code) => ({
      country_code,
      existing: await taxModuleService.listTaxRegions({ country_code }),
    })),
  );
  const missingTaxRegions = existingTaxRegions
    .filter(({ existing }) => existing.length === 0)
    .map(({ country_code }) => ({
      country_code,
      provider_id: "tp_system",
    }));
  if (missingTaxRegions.length) {
    await createTaxRegionsWorkflow(container).run({
      input: missingTaxRegions,
    });
  }
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  let stockLocations = await stockLocationModuleService.listStockLocations({
    name: "European Warehouse",
  });
  let stockLocation = stockLocations[0];
  if (!stockLocation) {
    const { result: stockLocationResult } = await createStockLocationsWorkflow(
      container,
    ).run({
      input: {
        locations: [
          {
            name: "European Warehouse",
            address: {
              city: "Copenhagen",
              country_code: "DK",
              address_1: "",
            },
          },
        ],
      },
    });
    stockLocation = stockLocationResult[0];
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_location_id: stockLocation.id,
      },
    },
  });

  try {
    await link.create({
      [Modules.SALES_CHANNEL]: {
        sales_channel_id: defaultSalesChannel[0].id,
      },
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_provider_id: "manual_manual",
      },
    });
  } catch {
    // link may already exist
  }

  logger.info("Seeding fulfillment data...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null;

  if (!shippingProfile) {
    const { result: shippingProfileResult } =
      await createShippingProfilesWorkflow(container).run({
        input: {
          data: [
            {
              name: "Default Shipping Profile",
              type: "default",
            },
          ],
        },
      });
    shippingProfile = shippingProfileResult[0];
  }

  let fulfillmentSets = await fulfillmentModuleService.listFulfillmentSets({
    name: "European Warehouse delivery",
  });
  let fulfillmentSet = fulfillmentSets[0];
  if (!fulfillmentSet) {
    fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "European Warehouse delivery",
      type: "shipping",
      service_zones: [
        {
          name: "Europe",
          geo_zones: [
            {
              country_code: "gb",
              type: "country",
            },
            {
              country_code: "de",
              type: "country",
            },
            {
              country_code: "dk",
              type: "country",
            },
            {
              country_code: "se",
              type: "country",
            },
            {
              country_code: "fr",
              type: "country",
            },
            {
              country_code: "es",
              type: "country",
            },
            {
              country_code: "it",
              type: "country",
            },
          ],
        },
      ],
    });
  }

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  const existingShippingOptions = await fulfillmentModuleService.listShippingOptions(
    { name: "Standard Shipping" },
  );
  if (!existingShippingOptions.length) {
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "Standard Shipping",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Standard",
            description: "Ship in 2-3 days.",
            code: "standard",
          },
          prices: [
            {
              currency_code: "usd",
              amount: 10,
            },
            {
              currency_code: "eur",
              amount: 10,
            },
            {
              region_id: region.id,
              amount: 10,
            },
          ],
          rules: [
            {
              attribute: "enabled_in_store",
              value: "true",
              operator: "eq",
            },
            {
              attribute: "is_return",
              value: "false",
              operator: "eq",
            },
          ],
        },
        {
          name: "Express Shipping",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Express",
            description: "Ship in 24 hours.",
            code: "express",
          },
          prices: [
            {
              currency_code: "usd",
              amount: 10,
            },
            {
              currency_code: "eur",
              amount: 10,
            },
            {
              region_id: region.id,
              amount: 10,
            },
          ],
          rules: [
            {
              attribute: "enabled_in_store",
              value: "true",
              operator: "eq",
            },
            {
              attribute: "is_return",
              value: "false",
              operator: "eq",
            },
          ],
        },
      ],
    });
  }
  logger.info("Finished seeding fulfillment data.");

  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: {
        id: stockLocation.id,
        add: [defaultSalesChannel[0].id],
      },
    });
  } catch {
    // link may already exist
  }
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding publishable API key data...");
  let publishableApiKey: ApiKey | null = null;
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id"],
    filters: {
      type: "publishable",
    },
  });

  publishableApiKey = data?.[0];

  if (!publishableApiKey) {
    const {
      result: [publishableApiKeyResult],
    } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          {
            title: "Webshop",
            type: "publishable",
            created_by: "",
          },
        ],
      },
    });

    publishableApiKey = publishableApiKeyResult as ApiKey;
  }

  try {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: {
        id: publishableApiKey.id,
        add: [defaultSalesChannel[0].id],
      },
    });
  } catch {
    // link may already exist
  }
  logger.info("Finished seeding publishable API key data.");

  logger.info("Seeding product data...");
  const taxonomy = await seedStoreTaxonomy(container);
  const seededProductIds = new Set<string>();
  const guitarTypeId =
    taxonomy.productTypeIdsByValue.get("guitar") ??
    taxonomy.productTypeIdsByValue.get("electric guitar") ??
    taxonomy.productTypeIdsByValue.get("acoustic guitar");
  const amplifierTypeId = taxonomy.productTypeIdsByValue.get("amplifier");
  const pedalTypeId = taxonomy.productTypeIdsByValue.get("effects pedal");
  const merchTypeId = taxonomy.productTypeIdsByValue.get("merchandise");
  const categoryNames = [
    "Guitars",
    "Amplifiers",
    "Effects",
    "Keyboards & Pianos",
    "Drums",
    "Accessories & Gear",
    "Merch",
  ];
  const categoryIdByName = new Map<string, string>();
  for (const name of categoryNames) {
    const existing = await productModuleService.listProductCategories({
      name,
    });
    if (existing.length) {
      categoryIdByName.set(name, existing[0].id);
      continue;
    }
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: [
          {
            name,
            is_active: true,
          },
        ],
      },
    });
    categoryIdByName.set(name, result[0].id);
  }

  const productPayloads = [
    {
      title: "Medusa Guitar",
      type_id: guitarTypeId,
      category_ids: [categoryIdByName.get("Guitars")!],
      description:
        "A simple guitar showcase product for the universal music store seed data.",
      handle: "guitar",
      weight: 400,
      status: ProductStatus.PUBLISHED,
      shipping_profile_id: shippingProfile.id,
      images: [
        {
          url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/guitar-black-front.png",
        },
        {
          url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/guitar-black-back.png",
        },
        {
          url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/guitar-white-front.png",
        },
        {
          url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/guitar-white-back.png",
        },
      ],
      options: [
        { title: "Type", values: ["Electric", "Acoustic"] },
        { title: "Finish", values: ["Black", "White"] },
      ],
      variants: [
        {
          title: "Electric / Black",
          sku: "GUITAR-ELC-BLACK",
          options: { Type: "Electric", Finish: "Black" },
          prices: [
            { amount: 10, currency_code: "eur" },
            { amount: 15, currency_code: "usd" },
          ],
        },
        {
          title: "Acoustic / Black",
          sku: "GUITAR-ACO-BLACK",
          options: { Type: "Acoustic", Finish: "Black" },
          prices: [
            { amount: 10, currency_code: "eur" },
            { amount: 15, currency_code: "usd" },
          ],
        },
        {
          title: "Electric / White",
          sku: "GUITAR-ELC-WHITE",
          options: { Type: "Electric", Finish: "White" },
          prices: [
            { amount: 10, currency_code: "eur" },
            { amount: 15, currency_code: "usd" },
          ],
        },
        {
          title: "Acoustic / White",
          sku: "GUITAR-ACO-WHITE",
          options: { Type: "Acoustic", Finish: "White" },
          prices: [
            { amount: 10, currency_code: "eur" },
            { amount: 15, currency_code: "usd" },
          ],
        },
      ],
      sales_channels: [{ id: defaultSalesChannel[0].id }],
    },
    {
      title: "Medusa Amplifier",
      type_id: amplifierTypeId,
      category_ids: [categoryIdByName.get("Amplifiers")!],
      description:
        "A simple amplifier showcase product for the universal music store seed data.",
      handle: "amplifier",
      weight: 400,
      status: ProductStatus.PUBLISHED,
      shipping_profile_id: shippingProfile.id,
      images: [
        {
          url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/amplifier-vintage-front.png",
        },
        {
          url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/amplifier-vintage-back.png",
        },
      ],
      options: [{ title: "Type", values: ["Combo", "Head", "Cabinet", "Practice"] }],
      variants: [
        {
          title: "Combo",
          sku: "AMP-COMBO",
          options: { Type: "Combo" },
          prices: [
            { amount: 10, currency_code: "eur" },
            { amount: 15, currency_code: "usd" },
          ],
        },
        {
          title: "Head",
          sku: "AMP-HEAD",
          options: { Type: "Head" },
          prices: [
            { amount: 10, currency_code: "eur" },
            { amount: 15, currency_code: "usd" },
          ],
        },
        {
          title: "Cabinet",
          sku: "AMP-CAB",
          options: { Type: "Cabinet" },
          prices: [
            { amount: 10, currency_code: "eur" },
            { amount: 15, currency_code: "usd" },
          ],
        },
        {
          title: "Practice",
          sku: "AMP-PRACTICE",
          options: { Type: "Practice" },
          prices: [
            { amount: 10, currency_code: "eur" },
            { amount: 15, currency_code: "usd" },
          ],
        },
      ],
      sales_channels: [{ id: defaultSalesChannel[0].id }],
    },
    {
      title: "Medusa Pedal",
      type_id: pedalTypeId,
      category_ids: [categoryIdByName.get("Effects")!],
      description:
        "A simple pedal showcase product for the universal music store seed data.",
      handle: "pedal",
      weight: 400,
      status: ProductStatus.PUBLISHED,
      shipping_profile_id: shippingProfile.id,
      images: [
        {
          url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/pedal-gray-front.png",
        },
        {
          url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/pedal-gray-back.png",
        },
      ],
      options: [{ title: "Type", values: ["Overdrive", "Delay", "Chorus", "Reverb"] }],
      variants: [
        {
          title: "Overdrive",
          sku: "PEDAL-OD",
          options: { Type: "Overdrive" },
          prices: [
            { amount: 10, currency_code: "eur" },
            { amount: 15, currency_code: "usd" },
          ],
        },
        {
          title: "Delay",
          sku: "PEDAL-DLY",
          options: { Type: "Delay" },
          prices: [
            { amount: 10, currency_code: "eur" },
            { amount: 15, currency_code: "usd" },
          ],
        },
        {
          title: "Chorus",
          sku: "PEDAL-CHR",
          options: { Type: "Chorus" },
          prices: [
            { amount: 10, currency_code: "eur" },
            { amount: 15, currency_code: "usd" },
          ],
        },
        {
          title: "Reverb",
          sku: "PEDAL-RVB",
          options: { Type: "Reverb" },
          prices: [
            { amount: 10, currency_code: "eur" },
            { amount: 15, currency_code: "usd" },
          ],
        },
      ],
      sales_channels: [{ id: defaultSalesChannel[0].id }],
    },
    {
      title: "Medusa Merch Pack",
      type_id: merchTypeId,
      category_ids: [categoryIdByName.get("Merch")!],
      description:
        "A simple merch pack for the universal music store seed data.",
      handle: "merch-pack",
      weight: 400,
      status: ProductStatus.PUBLISHED,
      shipping_profile_id: shippingProfile.id,
      images: [
        {
          url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/merch-pack-front.png",
        },
        {
          url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/merch-pack-back.png",
        },
      ],
      options: [{ title: "Edition", values: ["Standard", "Limited"] }],
      variants: [
        {
          title: "Standard",
          sku: "MERCH-STANDARD",
          options: { Edition: "Standard" },
          prices: [
            { amount: 10, currency_code: "eur" },
            { amount: 15, currency_code: "usd" },
            { amount: 85000, currency_code: "php" },
          ],
        },
        {
          title: "Limited",
          sku: "MERCH-LIMITED",
          options: { Edition: "Limited" },
          prices: [
            { amount: 10, currency_code: "eur" },
            { amount: 15, currency_code: "usd" },
            { amount: 85000, currency_code: "php" },
          ],
        },
      ],
      sales_channels: [{ id: defaultSalesChannel[0].id }],
    },
  ] as const;

  for (const product of productPayloads) {
    const existing = await productModuleService.listProducts({
      handle: product.handle,
    });
    if (existing.length) {
      logger.info(`Skipping existing product: ${product.handle}`);
      seededProductIds.add(existing[0].id);
      continue;
    }
    const { result } = await createProductsWorkflow(container).run({
      input: { products: [product as never] },
    });
    const createdProductId = result[0]?.id;
    if (createdProductId) {
      seededProductIds.add(createdProductId);
    }
    logger.info(`Created product: ${product.handle}`);
  }

  if (seededProductIds.size) {
    await linkProductsToSalesChannelWorkflow(container).run({
      input: {
        id: defaultSalesChannel[0].id,
        add: [...seededProductIds],
      },
    });
  }
  logger.info("Finished seeding product data.");

  logger.info("Seeding inventory levels.");

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  const inventoryLevelsToCreate: CreateInventoryLevelInput[] = [];
  const inventoryLevelsToUpdate: {
    id: string;
    inventory_item_id: string;
    location_id: string;
    stocked_quantity: number;
  }[] = [];
  for (const inventoryItem of inventoryItems) {
    const inventoryLevel = {
      location_id: stockLocation.id,
      stocked_quantity: 1000000,
      inventory_item_id: inventoryItem.id,
    };
    const existingLevels = await inventoryModuleService.listInventoryLevels({
      inventory_item_id: inventoryItem.id,
      location_id: stockLocation.id,
    });
    const existingLevel = existingLevels[0];
    if (existingLevel) {
      inventoryLevelsToUpdate.push({
        id: existingLevel.id,
        ...inventoryLevel,
      });
    } else {
      inventoryLevelsToCreate.push(inventoryLevel);
    }
  }

  await batchInventoryItemLevelsWorkflow(container).run({
    input: {
      create: inventoryLevelsToCreate,
      update: inventoryLevelsToUpdate,
    },
  });

  logger.info("Finished seeding inventory levels data.");
}
