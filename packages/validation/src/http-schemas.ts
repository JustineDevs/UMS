import { z } from "zod";

/** Medusa-style primary keys: prefix + underscore + alphanumerics (cart_, prod_, variant_, cus_, …). */
export const medusaResourceIdSchema = z
  .string()
  .trim()
  .min(6)
  .max(128)
  .regex(/^[a-z][a-z0-9]*_[A-Za-z0-9]+$/);

export const storefrontProductSlugSchema = z.string().trim().min(1).max(220);

export const medusaCartIdSchema = z
  .string()
  .trim()
  .regex(/^cart_[A-Za-z0-9]+$/)
  .max(128);

export const complianceEmailParamSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .email();

export const cartMergePostBodySchema = z.object({
  guestLines: z
    .array(
      z.object({
        variantId: medusaResourceIdSchema,
        quantity: z.coerce.number().int().min(1).max(999),
      }),
    )
    .max(100)
    .optional(),
});

export const storefrontReviewPostBodySchema = z.object({
  productSlug: storefrontProductSlugSchema,
  medusaProductId: medusaResourceIdSchema,
  body: z.string().trim().min(1).max(2000),
  rating: z.coerce.number().int().min(1).max(5),
  proofMediaUrl: z.union([z.string().trim().url().max(500), z.literal("")]).optional(),
  imageUrl: z.union([z.string().trim().url().max(500), z.literal("")]).optional(),
});

export const storefrontReviewsListQuerySchema = z
  .object({
    productSlug: storefrontProductSlugSchema.optional(),
    medusaProductId: medusaResourceIdSchema.optional(),
  })
  .refine((q) => Boolean(q.productSlug?.length || q.medusaProductId?.length), {
    message: "Provide productSlug and/or medusaProductId",
  });

const storefrontReturnRequestItemSchema = z.object({
  item_id: medusaResourceIdSchema,
  quantity: z.coerce.number().int().min(1).max(999),
  reason_id: medusaResourceIdSchema.optional(),
  note: z.string().trim().max(500).optional(),
});

export const storefrontReturnRequestBodySchema = z.object({
  orderId: z.string().trim().min(1).max(128),
  note: z.string().trim().max(1000).optional(),
  items: z.array(storefrontReturnRequestItemSchema).min(1).max(20),
});

const CMS_FORM_MAX_KEYS = 200;
const CMS_FORM_MAX_BYTES = 50_000;

export const cmsFormSubmissionPayloadSchema = z
  .record(z.string(), z.unknown())
  .superRefine((obj, ctx) => {
    const keys = Object.keys(obj);
    if (keys.length > CMS_FORM_MAX_KEYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `At most ${CMS_FORM_MAX_KEYS} fields allowed`,
      });
    }
    let bytes = 0;
    try {
      bytes = new TextEncoder().encode(JSON.stringify(obj)).length;
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Payload is not JSON-serializable",
      });
      return;
    }
    if (bytes > CMS_FORM_MAX_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Payload exceeds ${CMS_FORM_MAX_BYTES} bytes`,
      });
    }
  });

const CMS_BLOCK_TYPES = [
  "hero",
  "rich_text",
  "image",
  "cta_row",
  "divider",
  "two_column",
  "faq",
  "video",
  "trust_strip",
  "contact_strip",
  "newsletter",
  "featured_products",
  "payment_link",
] as const;

const cmsComponentPropTypeSchema = z.enum([
  "text",
  "rich-text",
  "url",
  "image",
  "boolean",
  "number",
  "color",
  "select",
  "json",
]);

const cmsComponentInstanceSchema: z.ZodTypeAny = z.lazy(() =>
  z
    .object({
      id: z.string().trim().min(1).max(128),
      componentId: z.string().trim().min(1).max(128),
      variantId: z.string().trim().min(1).max(128).optional(),
      props: z.record(z.string(), z.unknown()).default({}),
      slots: z.record(z.string(), z.array(cmsComponentInstanceSchema)).default({}),
      styleOverrides: z.record(z.string(), z.string().max(500)).optional(),
      lockedStructure: z.boolean().optional(),
    })
    .strict(),
);

export const cmsComponentDefinitionSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    name: z.string().trim().min(1).max(200),
    description: z.string().max(1000),
    category: z.string().trim().min(1).max(80),
    version: z.number().int().min(1).max(1000),
    structure: z.string().trim().min(1).max(1000),
    styleTokens: z.record(z.string(), z.string().max(500)).default({}),
    props: z
      .array(
        z
          .object({
            key: z.string().trim().min(1).max(128),
            label: z.string().trim().min(1).max(200),
            type: cmsComponentPropTypeSchema,
            description: z.string().max(500).optional(),
            required: z.boolean().optional(),
            defaultValue: z.unknown().optional(),
            options: z
              .array(z.object({ label: z.string().max(200), value: z.string().max(200) }).strict())
              .max(100)
              .optional(),
          })
          .strict(),
      )
      .max(100),
    slots: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(128),
            label: z.string().trim().min(1).max(200),
            description: z.string().max(500).optional(),
            allowedComponentIds: z.array(z.string().trim().min(1).max(128)).max(100).optional(),
            multiple: z.boolean().optional(),
          })
          .strict(),
      )
      .max(50),
    variants: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(128),
            label: z.string().trim().min(1).max(200),
            description: z.string().max(500).optional(),
            props: z.record(z.string(), z.unknown()).optional(),
            styleTokens: z.record(z.string(), z.string().max(500)).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
    extendsComponentId: z.string().trim().min(1).max(128).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
    defaultVariantId: z.string().trim().min(1).max(128).optional(),
    isGlobal: z.boolean().optional(),
  })
  .strict();

export const cmsBlockSchema = z.object({
  id: z.string().trim().min(1).max(128),
  type: z.enum(CMS_BLOCK_TYPES),
  props: z.record(z.string(), z.unknown()).default({}),
  componentId: z.string().trim().min(1).max(128).optional(),
  variantId: z.string().trim().min(1).max(128).optional(),
  slots: z.record(z.string(), z.array(cmsComponentInstanceSchema)).optional(),
  styleOverrides: z.record(z.string(), z.string().max(500)).optional(),
}).strict();

export type CmsBlockInput = z.infer<typeof cmsBlockSchema>;

export const cmsPagePutBodySchema = z.object({
  slug: z.string().trim().min(1).max(220).optional(),
  locale: z.string().trim().min(2).max(20).optional(),
  title: z.string().trim().min(0).max(500).optional(),
  body: z.string().max(200_000).optional(),
  blocks: z.array(cmsBlockSchema).max(200).optional(),
  status: z.enum(["draft", "published", "scheduled"]).optional(),
  scheduled_publish_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  page_type: z.enum(["static", "landing", "legal"]).optional(),
  seo_title: z.string().trim().max(200).nullable().optional(),
  seo_description: z.string().trim().max(400).nullable().optional(),
  preview_token: z.string().trim().max(128).nullable().optional(),
});

export const internalCustomerDataExportBodySchema = z.object({
  customerId: medusaResourceIdSchema,
  email: complianceEmailParamSchema,
  includeOrders: z.boolean().optional(),
  includeReviews: z.boolean().optional(),
  includeAddresses: z.boolean().optional(),
  includePayments: z.boolean().optional(),
});

export const internalCustomerDataErasureBodySchema = z.object({
  customerId: medusaResourceIdSchema,
  email: complianceEmailParamSchema,
  confirmationToken: z.string().trim().min(8).max(512),
  retainOrderRecords: z.boolean().default(false),
});
