import { z } from "zod";

export {
  cartMergePostBodySchema,
  cmsBlockSchema,
  cmsPagePutBodySchema,
  cmsFormSubmissionPayloadSchema,
  complianceEmailParamSchema,
  internalCustomerDataErasureBodySchema,
  internalCustomerDataExportBodySchema,
  medusaCartIdSchema,
  medusaResourceIdSchema,
  storefrontProductSlugSchema,
  storefrontReviewPostBodySchema,
  storefrontReviewsListQuerySchema,
  type CmsBlockInput,
} from "./http-schemas";

// Shared validation schemas

const PHILIPPINES_MOBILE_PHONE_ERROR =
  "Use a Philippine mobile (+63 or 09XXXXXXXXX).";

function buildOptionalIntegerQuerySchema(
  minimum: number,
  maximum: number,
): z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodNumber, number, unknown>, z.ZodNumber>> {
  return z.coerce
    .number()
    .transform((value) => Math.floor(value))
    .pipe(z.number().int().min(minimum).max(maximum))
    .optional();
}

function preprocessOptionalNonNegativeNumber(value: unknown): unknown {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return value;
  }
  return n;
}

function buildOptionalNonNegativeNumberQuerySchema() {
  return z.preprocess(
    preprocessOptionalNonNegativeNumber,
    z.number().nonnegative().optional(),
  );
}

function preprocessProductSearchQuery(value: unknown): string | undefined {
  if (value == null || value === "") {
    return undefined;
  }

  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed.slice(0, 80);
}

export const productListSortSchema = z.enum(["newest", "name_asc", "price_asc", "price_desc"]);

export const productListQuerySchema = z.object({
  limit: buildOptionalIntegerQuerySchema(1, 100),
  offset: buildOptionalIntegerQuerySchema(0, 50_000),
  category: z.string().trim().min(1).max(120).optional(),
  size: z.string().trim().min(1).max(40).optional(),
  color: z.string().trim().min(1).max(80).optional(),
  brand: z.string().trim().min(1).max(120).optional(),
  minPrice: buildOptionalNonNegativeNumberQuerySchema(),
  maxPrice: buildOptionalNonNegativeNumberQuerySchema(),
  /** Search product name or slug (ilike). */
  q: z.preprocess(
    preprocessProductSearchQuery,
    z.string().min(1).max(80).optional(),
  ),
  sort: productListSortSchema.optional(),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const orderStatusSchema = z.enum([
  "draft",
  "pending_payment",
  "paid",
  "ready_to_ship",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderChannelSchema = z.enum(["web", "pos"]);
export type OrderChannel = z.infer<typeof orderChannelSchema>;

export const userRoleSchema = z.enum(["admin", "staff", "customer"]);
export type UserRole = z.infer<typeof userRoleSchema>;

/** Default page size for shop product listing (matches storefront shop page). */
export const SHOP_PRODUCT_PAGE_SIZE = 20;

/** Philippine mobile: +639XXXXXXXXX, 639XXXXXXXXX, 09XXXXXXXXX, or 9XXXXXXXXX (10 digits after 9). */
export function isPhilippinesMobilePhone(raw: string): boolean {
  const normalized = raw.replace(/[\s-]/g, "");
  return /^(\+639|639|09|9)\d{9}$/.test(normalized);
}

export const storefrontShippingAddressSchema = z
  .object({
    id: z.string().uuid().optional(),
    label: z.string().trim().max(60).optional(),
    fullName: z.string().trim().min(1).max(120),
    phone: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .refine((v) => isPhilippinesMobilePhone(v), {
        message: PHILIPPINES_MOBILE_PHONE_ERROR,
      }),
    line1: z.string().trim().min(1).max(200),
    line2: z.string().trim().max(200).optional(),
    barangay: z.string().trim().max(120).optional(),
    city: z.string().trim().min(1).max(100),
    province: z.string().trim().min(1).max(100),
    postalCode: z.string().trim().max(20).optional(),
    country: z
      .string()
      .trim()
      .toUpperCase()
      .length(2)
      .default("PH"),
  })
  .superRefine((data, ctx) => {
    const cc = (data.country ?? "PH").toUpperCase();
    if (cc !== "PH") return;
    const b = data.barangay?.trim() ?? "";
    if (!b) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Barangay is required for Philippine addresses",
        path: ["barangay"],
      });
    }
  });

export type StorefrontShippingAddress = z.infer<
  typeof storefrontShippingAddressSchema
>;

export const storefrontCustomerProfilePatchSchema = z
  .object({
    displayName: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(40).optional(),
    shippingAddresses: z.array(storefrontShippingAddressSchema).max(5).optional(),
  })
  .superRefine((data, ctx) => {
    const ph = data.phone?.trim();
    if (ph && !isPhilippinesMobilePhone(ph)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: PHILIPPINES_MOBILE_PHONE_ERROR,
        path: ["phone"],
      });
    }
  });

export type StorefrontCustomerProfilePatch = z.infer<
  typeof storefrontCustomerProfilePatchSchema
>;

export {
  stockedQuantityFromVariantRaw,
  availableQuantityFromVariantRaw,
} from "./medusa-inventory-math";

export { sanitizeCmsHtml } from "./sanitize-cms-html";
