import fs from "node:fs";
import readline from "node:readline";
import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows";

type LegacyRow = {
  product: Record<string, unknown>;
  images: Record<string, unknown>[];
  variants: Record<string, unknown>[];
};

function resolveJsonlPath(): string {
  const fromEnv = process.env.MIGRATION_CATALOG_JSONL?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv;
  }
  const argvTail = process.argv.filter((a) => a.endsWith(".jsonl"));
  if (argvTail.length && fs.existsSync(argvTail[argvTail.length - 1])) {
    return argvTail[argvTail.length - 1];
  }
  throw new Error(
    "Set MIGRATION_CATALOG_JSONL to a readable .jsonl path, or pass a .jsonl path as the last CLI argument.",
  );
}

function legacyPriceToPhpMinor(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return 0;
  }
  if (process.env.LEGACY_PRICE_ALREADY_MINOR === "1") {
    return Math.max(0, Math.round(n));
  }
  return Math.max(0, Math.round(n * 100));
}

function mapProductStatus(raw: unknown): ProductStatus {
  const s = String(raw ?? "").toLowerCase();
  if (s === "draft") {
    return ProductStatus.DRAFT;
  }
  return ProductStatus.PUBLISHED;
}

function deriveOptions(variants: Record<string, unknown>[]) {
  const active = variants.filter(
    (v) => v.is_active !== false && v.is_active !== "false",
  );
  const types = [
    ...new Set(
      active
        .map((v) => String(v.type ?? v.size ?? "").trim())
        .filter((x) => x.length > 0),
    ),
  ];
  const finishes = [
    ...new Set(
      active
        .map((v) => String(v.finish ?? v.color ?? "").trim())
        .filter((x) => x.length > 0),
    ),
  ];
  const options: { title: string; values: string[] }[] = [];
  if (types.length) {
    options.push({ title: "Type", values: types });
  }
  if (finishes.length) {
    options.push({ title: "Finish", values: finishes });
  }
  if (!options.length) {
    options.push({ title: "Variant", values: ["Default"] });
  }
  return { active, options };
}

export default async function importLegacyCatalogJsonl({
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productModuleService = container.resolve(Modules.PRODUCT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);

  const salesChannelName =
    process.env.MIGRATION_SALES_CHANNEL_NAME?.trim() || "Web PH";
  const sc = await salesChannelModuleService.listSalesChannels({
    name: salesChannelName,
  });
  if (!sc.length) {
    throw new Error(
      `Sales channel "${salesChannelName}" not found. Run pnpm seed:ph (or seed) first.`,
    );
  }

  const profiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  const shippingProfile = profiles[0];
  if (!shippingProfile) {
    throw new Error("No default shipping profile. Run seed / seed:ph first.");
  }

  const categoryIdByName = new Map<string, string>();

  async function categoryIdFor(rawName: unknown): Promise<string | undefined> {
    const name = String(rawName ?? "").trim() || "Uncategorized";
    const hit = categoryIdByName.get(name);
    if (hit) {
      return hit;
    }
    const existing = await productModuleService.listProductCategories({
      name,
    });
    if (existing.length) {
      categoryIdByName.set(name, existing[0].id);
      return existing[0].id;
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
    return result[0].id;
  }

  const path = resolveJsonlPath();
  logger.info(`Import catalog JSONL: ${path}`);

  const stream = fs.createReadStream(path, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let lineNo = 0;
  let created = 0;
  let skipped = 0;
  const BATCH = Math.max(1, Number(process.env.MIGRATION_CATALOG_BATCH ?? 5));

  const productPayloads: Record<string, unknown>[] = [];

  const flush = async () => {
    if (!productPayloads.length) {
      return;
    }
    await createProductsWorkflow(container).run({
      input: { products: productPayloads as never },
    });
    created += productPayloads.length;
    productPayloads.length = 0;
  };

  for await (const line of rl) {
    lineNo += 1;
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    let row: LegacyRow;
    try {
      row = JSON.parse(trimmed) as LegacyRow;
    } catch {
      throw new Error(`Invalid JSON at line ${lineNo}`);
    }

    const p = row.product;
    const slug = String(p.slug ?? "").trim();
    const handle = slug || `legacy-product-${String(p.id)}`;
    const existing = await productModuleService.listProducts({ handle });
    if (existing.length) {
      skipped += 1;
      continue;
    }

    const { active, options } = deriveOptions(row.variants ?? []);
    if (!active.length) {
      logger.warn(`Skipping ${handle}: no active variants`);
      skipped += 1;
      continue;
    }

    const categoryId = await categoryIdFor(p.category);
    const images = (row.images ?? [])
      .filter((im) => String(im.image_url ?? "").length > 0)
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
      .map((im) => ({ url: String(im.image_url) }));

    const variants = active.map((v) => {
      const titleBits = [
        v.type != null && String(v.type).trim() ? String(v.type) : null,
        v.finish != null && String(v.finish).trim() ? String(v.finish) : null,
      ].filter(Boolean);
      const title =
        titleBits.join(" / ") || String(v.sku ?? "Variant") || handle;

      const opt: Record<string, string> = {};
      const hasType = options.some((o) => o.title === "Type");
      const hasFinish = options.some((o) => o.title === "Finish");
      if (hasType) {
        opt.Type = String(v.type ?? v.size ?? "").trim() || "Default";
      }
      if (hasFinish) {
        opt.Finish = String(v.finish ?? v.color ?? "").trim() || "Default";
      }
      if (options[0]?.title === "Variant") {
        opt.Variant = "Default";
      }

      const amount = legacyPriceToPhpMinor(v.price);
      const sku = String(v.sku ?? "").trim() || undefined;
      const barcode =
        v.barcode != null && String(v.barcode).trim()
          ? String(v.barcode).trim()
          : undefined;

      const meta: Record<string, unknown> = {};
      if (v.id != null) {
        meta.legacy_variant_id = String(v.id);
      }
      if (v.compare_at_price != null) {
        meta.legacy_compare_at_price_minor = legacyPriceToPhpMinor(
          v.compare_at_price,
        );
      }

      return {
        title,
        sku,
        barcode,
        manage_inventory: true,
        allow_backorder: false,
        options: opt,
        metadata: meta,
        prices:
          amount > 0
            ? [{ amount, currency_code: "php" }]
            : [{ amount: 0, currency_code: "php" }],
      };
    });

    const productMetadata: Record<string, unknown> = {};
    if (p.id != null) {
      productMetadata.legacy_product_id = String(p.id);
    }
    if (p.brand != null) {
      productMetadata.legacy_brand = String(p.brand);
    }
    if (p.category != null) {
      productMetadata.legacy_category = String(p.category);
    }

    productPayloads.push({
      title: String(p.name ?? handle),
      handle,
      description: p.description != null ? String(p.description) : undefined,
      status: mapProductStatus(p.status),
      shipping_profile_id: shippingProfile.id,
      category_ids: categoryId ? [categoryId] : [],
      metadata: productMetadata,
      images,
      options,
      variants,
      sales_channels: [{ id: sc[0].id }],
    });

    if (productPayloads.length >= BATCH) {
      await flush();
    }
  }

  await flush();

  logger.info(
    `Catalog import finished: created=${created} skipped_existing_or_empty=${skipped} lines=${lineNo}`,
  );
}
