import { z } from "zod";
import { catalogProductRequestSchema } from "./parse-catalog-product-body";
import { storefrontCustomerProfilePatchSchema } from "@universal-music-store/validation";
import { terminalPrintBodySchema, terminalPrintLabelBodySchema } from "./terminal-print-schemas";
import { cartMergePostBodySchema, cmsBlockSchema, cmsFormSubmissionPayloadSchema, storefrontReturnRequestBodySchema, storefrontReviewPostBodySchema } from "@universal-music-store/validation";
import {
  cmsAnnouncementSchema,
  cmsBlogBulkSchema,
  cmsBlogSchema,
  cmsExperimentSchema,
  cmsFormSettingsSchema,
  cmsFormSubmissionSchema,
  cmsNavigationSchema,
  cmsPageSchema,
  cmsPresetSchema,
  cmsRedirectBulkSchema,
  cmsRedirectSchema,
} from "./cms-route-contracts";
import { cmsComponentActionSchema, cmsComponentWriteSchema } from "./cms-component-contract";
import { e2eAuthRequestSchema, e2eAuthResponseSchema } from "./e2e-auth-contract";

export const adminCampaignCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.enum(["winback", "birthday", "first_purchase", "upsell", "custom"]),
  segment_id: z.string().uuid().nullable().optional(),
  subject: z.string().trim().max(240).nullable().optional(),
  body_template: z.string().max(100_000).nullable().optional(),
  schedule_cron: z.string().trim().max(120).nullable().optional(),
}).strict();

export const adminReceiptCreateSchema = z.object({
  order_id: z.string().trim().min(1).max(200),
  send: z.boolean().default(false),
}).strict();

export const adminInventoryAdjustmentSchema = z.object({
  productId: z.string().trim().min(1).max(200),
  variantId: z.string().trim().min(1).max(200),
  stockedQuantity: z.number().int().min(0).max(1_000_000).optional(),
  delta: z.number().int().min(-1_000_000).max(1_000_000).optional(),
  expectedStockedQuantity: z.number().int().min(0).max(1_000_000).optional(),
  locationId: z.string().trim().min(1).max(200).optional(),
  reason: z.enum(["receive", "count", "damage", "loss", "return", "correction", "transfer"]).default("correction"),
}).strict().superRefine((value, ctx) => {
  if ((value.stockedQuantity == null) === (value.delta == null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide exactly one of stockedQuantity or delta" });
  }
});

export const adminEmployeePinSchema = z.object({ pin: z.string().regex(/^\d{4,8}$/) }).strict();
export const adminOrderStatusSchema = z.object({
  status: z.enum(["pending", "paid", "processing", "packed", "shipped", "delivered", "cancelled", "returned", "refunded", "failed"]),
}).strict();
export const adminOrderStatusResponseSchema = z.object({
  status: adminOrderStatusSchema.shape.status,
}).strict();
export const adminOrderRefundResponseSchema = z.object({
  ok: z.literal(true),
  payment_id: z.string().min(1).max(200),
  provider: z.enum(["stripe", "paypal", "xendit"]),
  refund_id: z.string().min(1).max(200).nullable(),
  provider_status: z.string().min(1).max(100).nullable(),
  amount_minor: z.number().int().positive().max(1_000_000_000),
}).strict();
const adminBulkFulfillmentResultSchema = z.object({
  orderId: z.string().min(1).max(128),
  ok: z.boolean(),
  error: z.string().min(1).max(100).optional(),
  skipped: z.boolean().optional(),
  fulfillment_status: z.string().min(1).max(100).optional(),
  displayId: z.union([z.string().max(200), z.number().int()]).optional(),
  email: z.string().email().max(320).nullable().optional(),
}).strict();
export const adminBulkFulfillmentResponseSchema = z.object({
  total: z.number().int().min(1).max(100),
  succeeded: z.number().int().min(0).max(100),
  skipped: z.number().int().min(0).max(100),
  failed: z.number().int().min(0).max(100),
  results: z.array(adminBulkFulfillmentResultSchema).min(1).max(100),
}).strict();
export const adminDrawerRequestSchema = z.object({
  device_id: z.string().min(1).max(128).optional(),
  reason: z.string().trim().min(1).max(200).optional(),
}).strict();
export const adminTrackingCapabilityRevokeSchema = z.object({
  token: z.string().trim().min(8).max(4096),
  resourceId: z.string().trim().min(1).max(200),
  reason: z.string().trim().max(500).nullable().optional(),
}).strict();
export const adminPinApprovalSchema = z.object({
  approver_employee_id: z.string().uuid(),
  pin: z.string().regex(/^\d{4,8}$/),
  required_role: z.enum(["admin", "manager"]).default("manager"),
}).strict();
export const adminShiftCloseSchema = z.object({
  closing_cash: z.number().finite().nonnegative(),
  notes: z.string().trim().max(1000).optional(),
}).strict();

export const adminCatalogCategoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  handle: z.string().trim().min(1).max(160).optional(),
}).strict();

export const adminBulkFulfillmentSchema = z.object({
  orderIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)).min(1).max(100),
  trackingNumber: z.string().trim().max(120).optional(),
  carrierId: z.string().trim().max(80).optional(),
  notifyCustomer: z.boolean().default(true),
}).strict();

export const adminChatOrderStatusSchema = z.object({
  status: z.enum(["processing", "cancelled"]),
}).strict();
export const adminChatOrderStatusResponseSchema = z.object({ id: z.string().min(1).max(128), status: z.enum(["processing", "cancelled"]) }).strict();
export const adminChatOrderIntakeResponseSchema = z.object({
  id: z.string().min(1).max(128), draftOrderId: z.string().min(1).max(200), status: z.enum(["pending", "draft_created", "processing", "cancelled", "failed", "completed"]),
}).strict();

export const adminDeviceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  type: z.enum(["terminal", "printer", "kds", "scanner"]).default("terminal"),
  ip_address: z.string().trim().max(64).optional(),
  is_active: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const adminWorkflowTransitionSchema = z.object({
  entity_type: z.enum(["catalog_product", "sales_order", "inventory_adjustment", "campaign", "cms_page", "chat_order"]),
  entity_id: z.string().trim().min(1).max(200),
  to_state: z.string().trim().min(1).max(40),
  notes: z.string().trim().max(2000).nullable().optional(),
  expected_updated_at: z.string().datetime().optional(),
}).strict();

const adminInventoryLineSchema = z.object({
  productId: z.string().trim().min(1).max(200),
  variantId: z.string().trim().min(1).max(200),
}).strict();
export const adminCycleCountCreateSchema = z.object({
  locationId: z.string().trim().min(1).max(200),
  lines: z.array(adminInventoryLineSchema).min(1).max(500),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.lines.map((line) => line.variantId)).size !== value.lines.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lines"], message: "A variant may only appear once" });
  }
});

const adminPurchaseOrderLineSchema = adminInventoryLineSchema.extend({
  orderedQuantity: z.number().int().positive().max(1_000_000),
  unitCostMinor: z.number().int().nonnegative().max(1_000_000_000),
});
export const adminPurchaseOrderCreateSchema = z.object({
  supplierName: z.string().trim().min(1).max(200),
  destinationLocationId: z.string().trim().min(1).max(200),
  currencyCode: z.literal("PHP").default("PHP"),
  lines: z.array(adminPurchaseOrderLineSchema).min(1).max(100),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.lines.map((line) => line.variantId)).size !== value.lines.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lines"], message: "A variant may only appear once" });
  }
});

export const accountMarketingPreferencesPatchSchema = z.object({
  subscribed: z.boolean(),
  channel: z.enum(["email", "order_updates", "back_in_stock", "promotions", "wallet", "platform_updates"]).default("email"),
}).strict();

export const accountOrderPreferencesPatchSchema = z.object({
  outOfStockAction: z.enum(["remove_and_continue", "cancel_order", "ask_me"]),
}).strict();

export const adminLoyaltyCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  medusa_customer_id: z.string().trim().max(200).optional(),
}).strict();

export const adminLoyaltyPointsSchema = z.object({
  account_id: z.string().trim().min(1).max(200),
  points: z.number().int().positive().max(1_000_000),
  reason: z.string().trim().min(1).max(500),
  order_id: z.string().trim().max(200).optional(),
  action: z.enum(["add", "redeem"]).default("add"),
}).strict();

export const adminLoyaltyRewardCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2_000).optional(),
  points_cost: z.number().int().positive().max(1_000_000),
  reward_type: z.enum(["discount", "free_item", "free_shipping", "custom"]).default("discount"),
  reward_value: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const adminSegmentCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  rule_type: z.enum(["spend_above", "spend_below", "order_count_above", "inactive_days", "product_category", "tier", "manual"]),
  rule_config: z.record(z.string(), z.unknown()).default({}),
  auto_refresh: z.boolean().default(true),
}).strict();

export const adminSegmentMembersSchema = z.object({
  members: z.array(z.object({
    customer_email: z.string().trim().toLowerCase().email().max(320),
    medusa_customer_id: z.string().trim().max(200).optional(),
  }).strict()).min(1).max(500),
}).strict();

const adminEmployeeFields = {
  full_name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(320).optional(),
  phone: z.string().trim().max(40).optional(),
  role: z.enum(["admin", "manager", "cashier", "staff"]).optional(),
  hired_at: z.string().datetime().optional(),
  user_id: z.string().trim().max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
};
export const adminEmployeeCreateSchema = z.object(adminEmployeeFields).strict();
export const adminEmployeePatchSchema = z.object({
  ...adminEmployeeFields,
  is_active: z.boolean().optional(),
}).partial().strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one employee field is required",
});

export const adminOperatorNoteCreateSchema = z.object({
  entity_type: z.enum(["catalog_product", "sales_order", "inventory_adjustment", "campaign", "cms_page", "chat_order"]),
  entity_id: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
}).strict();

export const adminOfflineQueueCreateSchema = z.object({
  device_name: z.string().trim().min(1).max(200),
  employee_id: z.string().trim().max(200).optional(),
  payload: z.record(z.string(), z.unknown()),
}).strict();
export const adminOfflineQueuePatchSchema = z.object({
  id: z.string().trim().min(1).max(200),
  action: z.enum(["synced", "failed"]),
  error_message: z.string().trim().max(2_000).optional(),
}).strict();

export const storefrontApplyPromoSchema = z.object({
  cartId: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(64),
}).strict();
export const storefrontTrackingLinkSchema = z.object({
  cartId: z.string().trim().min(1).max(120),
}).strict();
export const adminPosCommerceLookupSchema = z.object({
  barcode: z.string().trim().max(200).optional(),
  sku: z.string().trim().max(200).optional(),
}).strict().refine((value) => Boolean(value.barcode || value.sku), {
  message: "barcode or sku is required",
});
export const storefrontPrivacyErasureConfirmationSchema = z.object({
  confirmation: z.literal("DELETE"),
}).strict();
export const cmsAnnouncementTrackSchema = z.object({
  id: z.string().trim().min(1).max(120),
  locale: z.string().trim().min(2).max(16).default("en"),
  metric: z.enum(["impression", "click", "dismiss"]),
}).strict();
export const cmsExperimentImpressionSchema = z.object({
  experiment_key: z.string().trim().min(1).max(120),
  variant_id: z.string().trim().min(1).max(120),
}).strict();
export const trackingLinkResolveSchema = z.object({
  trackingUrl: z.string().trim().url().max(8192),
}).strict();
export const storefrontReviewRouteSchema = storefrontReviewPostBodySchema.extend({
  recaptchaToken: z.string().trim().min(1).max(4096).optional(),
});
export const checkoutCommerceTelemetrySchema = z.object({
  event: z.string().trim().min(1).max(80),
}).catchall(z.unknown());
const checkoutPaymentProviderKeySchema = z.enum(["STRIPE", "PAYPAL", "XENDIT", "COD"]);
export const checkoutAvailablePaymentMethodsResponseSchema = z.union([
  z.object({ ok: z.literal(true), keys: z.array(checkoutPaymentProviderKeySchema).max(4), code: z.literal("OK"), error: z.null(), message: z.null() }).strict(),
  z.object({ ok: z.literal(false), keys: z.array(checkoutPaymentProviderKeySchema).max(4), code: z.string().trim().min(1).max(120), error: z.string().trim().min(1).max(120), message: z.string().trim().min(1).max(500) }).strict(),
]);
export const checkoutPreviewResponseSchema = z.object({
  subtotal: z.number().finite().nonnegative(), taxTotal: z.number().finite().nonnegative(), shippingTotal: z.number().finite().nonnegative(),
  discountTotal: z.number().finite().nonnegative(), total: z.number().finite().nonnegative(), currencyCode: z.string().regex(/^[A-Z]{3,8}$/),
  lineSubtotalsByVariantId: z.record(z.string().min(1).max(200), z.number().finite().nonnegative()).refine((value) => Object.keys(value).length <= 50),
  quoteFingerprint: z.string().regex(/^[a-f0-9]{64}$/), variantIds: z.array(z.string().min(1).max(200)).max(50), productIds: z.array(z.string().min(1).max(200)).max(50),
  shippingMethodIds: z.array(z.string().max(200)).max(50), regionId: z.string().max(200).nullable(), shippingOptions: z.array(z.unknown()).max(50), appliedShippingOptionId: z.string().max(200).nullable(),
}).strict();
export const checkoutVerifyStockSchema = z.object({
  lines: z.array(z.object({
    variantId: z.string().trim().min(1).max(200),
    quantity: z.number().finite().positive().max(1_000_000),
  }).strict()).min(1).max(500),
}).strict();
export const internalReconcilePaymentAttemptSchema = z.object({
  correlationId: z.string().trim().min(1).max(200),
}).strict();
export const paymentCheckoutIntentSchema = z.object({
  provider: z.enum(["cod", "stripe", "paypal", "xendit"]),
  lines: z.array(z.object({
    variantId: z.string().trim().min(1).max(200),
    quantity: z.number().finite().int().positive().max(999),
  }).strip()).max(50).optional(),
  amountMinor: z.number().finite().nonnegative().max(1_000_000_000).optional(),
  currencyCode: z.string().trim().min(3).max(8).default("PHP"),
  quoteFingerprint: z.string().trim().max(512).optional(),
  variantIds: z.array(z.string().trim().min(1).max(200)).max(500).optional(),
  productIds: z.array(z.string().trim().min(1).max(200)).max(500).optional(),
  medusaPaymentSessionId: z.string().trim().max(200).optional(),
  providerSessionId: z.string().trim().max(200).optional(),
  providerPaymentId: z.string().trim().max(200).optional(),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
}).strict();

const optionalBoundedText = (max: number) => z.string().trim().max(max).optional();
const optionalSafeLink = z.string().trim().max(2_048).optional();

export const adminProfilePatchSchema = z.object({
  name: optionalBoundedText(200),
}).strict();

export const adminRuntimeSettingsSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  storeName: optionalBoundedText(320),
  supportEmail: optionalBoundedText(320),
  supportPhone: optionalBoundedText(320),
  cmsLocale: optionalBoundedText(16),
  merchantCountry: optionalBoundedText(3),
  enabledPaymentProviders: z.array(z.enum(["STRIPE", "PAYPAL", "XENDIT", "COD"])).max(4).optional(),
  featureFlags: z.object({
    stripe: z.boolean().optional(), paypal: z.boolean().optional(), xendit: z.boolean().optional(),
    pancakePos: z.boolean().optional(), loyalty: z.boolean().optional(), reviews: z.boolean().optional(), experiments: z.boolean().optional(),
  }).strict().optional(),
  retentionDays: z.number().int().min(1).max(3_650).optional(),
  lowStockThreshold: z.number().int().min(0).max(10_000_000).optional(),
  rateLimits: z.object({
    checkoutIntentPerMinute: z.number().int().min(1).max(10_000).optional(),
    checkoutBurstPerMinute: z.number().int().min(1).max(10_000).optional(),
    checkoutMaxPer15Minutes: z.number().int().min(1).max(100_000).optional(),
    publicTrackPerMinute: z.number().int().min(1).max(10_000).optional(),
  }).strict().optional(),
  pickup: z.object({
    name: optionalBoundedText(320), phone: optionalBoundedText(320), province: optionalBoundedText(320),
    city: optionalBoundedText(320), area: optionalBoundedText(320), address: optionalBoundedText(1_000),
  }).strict().optional(),
  policyLinks: z.object({
    shipping: optionalSafeLink, returns: optionalSafeLink, terms: optionalSafeLink, privacy: optionalSafeLink,
    cookies: optionalSafeLink, accessibility: optionalSafeLink, warrantyPdf: optionalSafeLink,
  }).strict().optional(),
  medusa: z.object({ regionId: optionalBoundedText(128), salesChannelId: optionalBoundedText(128), paymentProviderId: optionalBoundedText(128) }).strict().optional(),
  nangoPaymentConnectionId: optionalBoundedText(256),
  nangoPaymentProviderConfigKey: optionalBoundedText(256),
}).strict();

export const adminStorefrontPublicMetadataSchema = z.object({
  storeName: optionalBoundedText(320), instagramUrl: optionalSafeLink, facebookUrl: optionalSafeLink,
  tiktokUrl: optionalSafeLink, youtubeUrl: optionalSafeLink, xUrl: optionalSafeLink, linkedinUrl: optionalSafeLink,
  whatsappUrl: optionalSafeLink, messengerUrl: optionalSafeLink, supportEmail: optionalBoundedText(320), supportPhone: optionalBoundedText(320),
  shippingPolicyUrl: optionalSafeLink, returnsPolicyUrl: optionalSafeLink, termsUrl: optionalSafeLink, privacyUrl: optionalSafeLink,
  cookiesUrl: optionalSafeLink, accessibilityUrl: optionalSafeLink, warrantyPdfUrl: optionalSafeLink,
}).strict();

const homeLayoutSchema = z.object({
  maxWidth: optionalBoundedText(40), minHeight: optionalBoundedText(40), paddingBlock: optionalBoundedText(40), paddingInline: optionalBoundedText(40),
}).strict();
const homeStyleSchema = z.object({
  headlineFont: z.enum(["headline", "body", "mono"]).optional(), textTone: z.enum(["brand", "neutral", "muted"]).optional(),
  headlineSize: z.enum(["compact", "default", "hero"]).optional(), contentWidth: z.enum(["standard", "wide", "extra"]).optional(),
}).strict();
export const adminStorefrontHomeSchema = z.object({
  visualBlocks: z.array(cmsBlockSchema).max(200).optional(),
  domOverrides: z.record(z.string().trim().min(1).max(128), z.record(z.string().trim().min(1).max(128), z.string().max(500))).superRefine((value, ctx) => {
    if (Object.keys(value).length > 200) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At most 200 DOM override entries allowed" });
  }).optional(),
  sectionLayout: z.object({ hero: homeLayoutSchema.optional(), tiles: homeLayoutSchema.optional(), latest: homeLayoutSchema.optional(), newsletter: homeLayoutSchema.optional() }).strict().optional(),
  hero: z.object({
    line1: optionalBoundedText(320), line2: optionalBoundedText(320), lead: optionalBoundedText(2_000), showPrivacyLink: z.boolean().optional(),
    ctaLabel: optionalBoundedText(200), ctaHref: optionalSafeLink, imageUrl: optionalSafeLink, mediaType: z.enum(["image", "video"]).optional(), videoUrl: optionalSafeLink,
    layout: homeLayoutSchema.optional(), style: homeStyleSchema.optional(),
  }).strict().optional(),
  tiles: z.array(z.object({ href: optionalSafeLink, title: optionalBoundedText(320), linkLabel: optionalBoundedText(200), subtitle: optionalBoundedText(500), imageUrl: optionalSafeLink, variant: z.enum(["large", "small", "wide"]).optional() }).strict()).max(100).optional(),
  latestSection: z.object({ title: optionalBoundedText(320), viewAllLabel: optionalBoundedText(200), viewAllHref: optionalSafeLink }).strict().optional(),
  newsletter: z.object({ title: optionalBoundedText(320), body: optionalBoundedText(2_000), placeholder: optionalBoundedText(320), buttonLabel: optionalBoundedText(200) }).strict().optional(),
}).strict();
export const adminStorefrontHomeResponseSchema = z.object({
  data: adminStorefrontHomeSchema,
  devMode: z.boolean().optional(),
}).strict();

const boundedJsonObject = z.record(z.string().trim().min(1).max(128), z.unknown()).superRefine((value, ctx) => {
  if (Object.keys(value).length > 100) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At most 100 object fields allowed" });
});
const adminCrmCommonSchema = {
  provider_config_key: optionalBoundedText(128), connection_id: optionalBoundedText(200), sync_scope: z.enum(["global", "organization", "branch", "customer"]).optional(),
  branch_id: optionalBoundedText(200), staff_user_id: optionalBoundedText(200), staff_email: optionalBoundedText(320), workspace_id: optionalBoundedText(200),
  connection_name: optionalBoundedText(200), branch_label: optionalBoundedText(200), enabled_entities: z.array(z.enum(["contact", "deal"])).max(2).optional(), active: z.boolean().optional(),
};
export const adminCrmBridgeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("connection"), ...adminCrmCommonSchema }).strict(),
  z.object({ kind: z.literal("record"), ...adminCrmCommonSchema, local_entity_type: z.enum(["contact", "deal"]), local_record_id: z.string().trim().min(1).max(200), local_record_label: optionalBoundedText(320), external_entity_type: z.enum(["contact", "deal"]).optional(), external_record_id: optionalBoundedText(200), external_account_id: optionalBoundedText(200), sync_state: z.enum(["pending", "synced", "partial", "failed", "manual_only", "disabled", "stale"]).optional(), sync_mode: z.enum(["automatic", "manual", "disabled"]).optional(), last_direction: z.enum(["to_crm", "from_crm", "bidirectional"]).optional() }).strict(),
  z.object({ kind: z.literal("mapping"), customer_email: z.string().trim().email().max(320), medusa_customer_id: optionalBoundedText(200), ...adminCrmCommonSchema, external_contact_id: optionalBoundedText(200), external_account_id: optionalBoundedText(200), sync_state: z.enum(["pending", "synced", "partial", "failed", "manual_only", "disabled", "stale"]).optional(), sync_mode: z.enum(["automatic", "manual", "disabled"]).optional(), customer_name: optionalBoundedText(320), notes: optionalBoundedText(2_000) }).strict(),
]);
const deliveryAddressSchema = boundedJsonObject;
export const adminDeliveryShipmentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("shipment"), order_id: z.string().trim().min(1).max(200), branch_id: optionalBoundedText(200), courier_slug: optionalBoundedText(100), courier_label: optionalBoundedText(200), status: z.enum(["planned", "assigned", "in_transit", "delivered", "returned", "cancelled"]).optional(), origin_address: deliveryAddressSchema.optional(), destination_address: deliveryAddressSchema.optional(), geocoded_destination: deliveryAddressSchema.optional(), package_dimensions: deliveryAddressSchema.optional(), hazard_flags: z.array(z.string().trim().max(100)).max(50).optional(), route_metadata: deliveryAddressSchema.optional(), tracking_url: optionalSafeLink, tracking_status: optionalBoundedText(100), proof_of_delivery: deliveryAddressSchema.optional(), cod_amount: z.number().finite().nonnegative().max(1_000_000_000).optional(), driver_cash_balance: z.number().finite().nonnegative().max(1_000_000_000).optional(), settlement_status: z.enum(["held", "reconciled", "remitted", "none", "pending"]).optional(), pricing: deliveryAddressSchema.optional(), metadata: deliveryAddressSchema.optional(), medusa_fulfillment_id: optionalBoundedText(200), provider_shipment_id: optionalBoundedText(200), eta_at: z.string().datetime().optional() }).strict(),
  z.object({ kind: z.literal("event"), shipment_id: z.string().trim().min(1).max(200), event_type: z.string().trim().min(1).max(100), event_status: optionalBoundedText(100), event_payload: deliveryAddressSchema.optional(), occurred_at: z.string().datetime().optional() }).strict(),
]);
const invoiceItemSchema = z.object({ description: z.string().trim().min(1).max(240), quantity: z.number().int().min(1).max(10_000), unitPrice: z.number().finite().nonnegative().max(100_000_000) }).strict();
export const adminInvoiceCreateSchema = z.object({
  invoice: z.object({ referenceNumber: z.string().trim().min(1).max(80), to: z.object({ id: z.string().trim().min(1).max(80), email: z.string().trim().email().max(320) }).strict(), items: z.array(invoiceItemSchema).min(1).max(100), discountType: z.enum(["fixed", "percent"]).optional(), discountValue: z.number().finite().nonnegative().max(100_000_000).optional(), taxRate: z.number().finite().min(0).max(100).optional() }).strict(),
  documentKind: z.enum(["admin_artifact", "commercial_invoice", "fiscal_invoice"]).optional(), fiscalNumber: z.string().trim().max(80).optional(), mode: z.enum(["draft", "send"]).optional(), medusaOrderId: optionalBoundedText(255), refundId: optionalBoundedText(255),
}).strict();
export const adminInvoiceLifecycleSchema = z.object({
  action: z.enum(["retry", "void", "refund"]),
}).strict();
export const adminChatOrderIntakeSchema = z.object({ source: z.string().trim().min(1).max(80).optional(), items: z.array(z.object({ variantId: z.string().trim().min(1).max(200), quantity: z.number().int().min(1).max(100) }).strict()).min(1).max(50), raw_text: optionalBoundedText(4_000), phone: optionalBoundedText(64), address: optionalBoundedText(1_000) }).strict();
export const internalCommerceInvalidationSchema = z.object({ scope: z.enum(["commerce", "cms"]).optional(), classification: z.enum(["editorial_only", "merchandising_only", "sellability_affecting", "checkout_affecting"]).optional(), productHandles: z.array(z.string().trim().min(1).max(220)).max(200).optional(), productIds: z.array(z.string().trim().min(1).max(200)).max(200).optional(), variantIds: z.array(z.string().trim().min(1).max(200)).max(200).optional(), collectionHandles: z.array(z.string().trim().min(1).max(220)).max(200).optional(), actorEmail: z.string().trim().email().max(320).nullable().optional(), reason: optionalBoundedText(1_000) }).strict();
export const adminPaymentReceiptUploadSchema = z.object({ orderId: z.string().trim().min(1).max(200) }).strict();
export const adminProfileResponseSchema = z.object({
  ok: z.literal(true),
  name: z.string().nullable(),
}).strict();
const storefrontPublicMetadataDataSchema = z.object({
  storeName: z.string(), instagramUrl: z.string(), facebookUrl: z.string(), tiktokUrl: z.string(), youtubeUrl: z.string(),
  xUrl: z.string(), linkedinUrl: z.string(), whatsappUrl: z.string(), messengerUrl: z.string(), supportEmail: z.string(), supportPhone: z.string(),
  shippingPolicyUrl: z.string(), returnsPolicyUrl: z.string(), termsUrl: z.string(), privacyUrl: z.string(), cookiesUrl: z.string(), accessibilityUrl: z.string(), warrantyPdfUrl: z.string(),
}).strict();
export const adminStorefrontPublicMetadataResponseSchema = z.object({ data: storefrontPublicMetadataDataSchema }).strict();
const runtimeSettingsDataSchema = z.object({
  maintenanceMode: z.boolean(), storeName: z.string(), supportEmail: z.string(), supportPhone: z.string(), cmsLocale: z.string(), merchantCountry: z.string(),
  enabledPaymentProviders: z.array(z.enum(["STRIPE", "PAYPAL", "XENDIT", "COD"])),
  featureFlags: z.object({ stripe: z.boolean(), paypal: z.boolean(), xendit: z.boolean(), pancakePos: z.boolean(), loyalty: z.boolean(), reviews: z.boolean(), experiments: z.boolean() }).strict(),
  retentionDays: z.number().int(), lowStockThreshold: z.number().int(),
  rateLimits: z.object({ checkoutIntentPerMinute: z.number().int(), checkoutBurstPerMinute: z.number().int(), checkoutMaxPer15Minutes: z.number().int(), publicTrackPerMinute: z.number().int() }).strict(),
  pickup: z.object({ name: z.string(), phone: z.string(), province: z.string(), city: z.string(), area: z.string(), address: z.string() }).strict(),
  policyLinks: z.object({ shipping: z.string(), returns: z.string(), terms: z.string(), privacy: z.string(), cookies: z.string(), accessibility: z.string(), warrantyPdf: z.string() }).strict(),
  medusa: z.object({ regionId: z.string(), salesChannelId: z.string(), paymentProviderId: z.string() }).strict(),
  nangoPaymentConnectionId: z.string(), nangoPaymentProviderConfigKey: z.string(),
}).strict();
export const adminRuntimeSettingsResponseSchema = z.object({ data: runtimeSettingsDataSchema }).strict();

const platformFeatureMappingSchema = z.object({
  key: z.string(),
  domain: z.enum(["pos", "logistics", "multi_channel", "crm", "support", "integrations", "payroll_remittance"]),
  label: z.string(),
  status: z.enum(["implemented", "partial", "planned"]),
  systemOfRecord: z.string(),
  adminSurfaces: z.array(z.string()),
  storefrontSurfaces: z.array(z.string()),
  apiSurfaces: z.array(z.string()),
  dataFlow: z.array(z.string()),
  ossOrProvider: z.array(z.object({ name: z.string(), role: z.string(), url: z.string().url() }).strict()),
  notes: z.string(),
}).strict();
const platformFeatureMappingMetadataSchema = z.object({
  mappings: z.array(platformFeatureMappingSchema),
  coverage: z.object({ total: z.number().int().nonnegative(), implemented: z.number().int().nonnegative(), partial: z.number().int().nonnegative(), planned: z.number().int().nonnegative() }).strict(),
}).strict();
export const adminFeatureMappingsResponseSchema = z.object({
  data: platformFeatureMappingMetadataSchema,
  generatedAt: z.string().datetime(),
  count: z.number().int().nonnegative(),
}).strict();

const integrationHealthEntrySchema = z.object({
  provider: z.string(),
  status: z.enum(["healthy", "degraded", "down", "unconfigured"]),
  sdkVersion: z.string().nullable(),
  lastWebhookAt: z.string().datetime().nullable(),
  webhookStatus: z.enum(["unknown", "healthy", "failing"]),
  envPresent: z.boolean(),
  note: z.string(),
}).strict();
export const adminIntegrationHealthResponseSchema = z.object({ entries: z.array(integrationHealthEntrySchema) }).strict();

const paymentProviderStatusSchema = z.object({
  enabled: z.boolean(),
  webhookConfigured: z.boolean(),
  sandboxMode: z.boolean().optional(),
  notes: z.string().optional(),
}).strict();
export const adminPaymentHealthResponseSchema = z.object({
  environment: z.string(),
  isProduction: z.boolean(),
  providers: z.object({ stripe: paymentProviderStatusSchema, paypal: paymentProviderStatusSchema, xendit: paymentProviderStatusSchema, cod: paymentProviderStatusSchema }).strict(),
  warnings: z.array(z.string()),
  ok: z.boolean(),
}).strict();

const paymentCapabilitySchema = z.enum(["hosted_checkout", "payment_links", "embedded_checkout", "catalog_sync", "recurring_billing", "save_payment_method", "authorize", "capture", "partial_capture", "refund", "partial_refund", "void", "invoices", "disputes", "payouts", "connected_accounts", "channel_discovery", "future_charge"]);
const paymentCapabilityDefinitionSchema = z.object({
  provider: z.enum(["stripe", "paypal", "xendit"]),
  capabilities: z.array(paymentCapabilitySchema),
  implementedCapabilities: z.array(paymentCapabilitySchema),
  verifiedCapabilities: z.array(paymentCapabilitySchema),
  checkoutModes: z.array(z.enum(["hosted", "embedded"])),
  notes: z.string(),
}).strict();
export const adminPaymentCapabilitiesResponseSchema = z.object({
  data: z.array(paymentCapabilityDefinitionSchema.extend({
    configured: z.boolean(),
    policy: z.union([z.object({ locked: z.literal(true), code: z.string() }).strict(), z.object({ locked: z.literal(false) }).strict()]),
    unavailableInUvs: z.array(paymentCapabilitySchema),
  })),
}).strict();

const adminTaskItemSchema = z.object({
  id: z.string(), type: z.string(), title: z.string(), description: z.string(),
  urgency: z.enum(["high", "medium", "low"]), link: z.string(), count: z.number().int().nonnegative().optional(),
}).strict();
export const adminTasksTodayResponseSchema = z.object({ tasks: z.array(adminTaskItemSchema) }).strict();

const adminRoleSummarySchema = z.object({
  role: z.string(), group: z.string(), accessLevel: z.string(), users: z.number().int().nonnegative(),
  permissionSets: z.array(z.string()), lastReview: z.string(), owner: z.string(), status: z.literal("Active"),
}).strict();
export const adminRolesResponseSchema = z.object({ data: z.array(adminRoleSummarySchema) }).strict();

const analyticsClvSchema = z.object({
  customer_email: z.string().email(), total_spent: z.number().finite(), order_count: z.number().int().nonnegative(),
  avg_order_value: z.number().finite(), first_order_at: z.string().datetime().nullable(), last_order_at: z.string().datetime().nullable(),
}).strict();
const analyticsRetentionSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/), new_customers: z.number().int().nonnegative(), returning_customers: z.number().int().nonnegative(), retention_rate: z.number().finite().min(0).max(1),
}).strict();
const analyticsSalesTrendSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/), revenue: z.number().finite(), order_count: z.number().int().nonnegative(), avg_order_value: z.number().finite(),
}).strict();
export const adminAnalyticsClvResponseSchema = z.object({ data: analyticsClvSchema }).strict();
export const adminAnalyticsRetentionResponseSchema = z.object({ data: z.array(analyticsRetentionSchema).max(24) }).strict();
export const adminAnalyticsSalesTrendsResponseSchema = z.object({ data: z.array(analyticsSalesTrendSchema).max(24) }).strict();

const unifiedSessionSchema = z.object({
  user: z.object({ id: z.string().optional(), email: z.string().email().optional(), name: z.string().nullable().optional(), image: z.string().nullable().optional(), role: z.string().optional(), permissions: z.array(z.string()).optional() }).strict(),
  expires: z.string().datetime(), authenticatedAt: z.number().finite().optional(),
}).strict();
export const authSessionResponseSchema = unifiedSessionSchema.nullable();
export const healthResponseSchema = z.object({
  service: z.literal("storefront"),
  status: z.literal("ok"),
  timestamp: z.string().datetime(),
}).strict();
export const healthSopResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  commerceSource: z.literal("cloudflare_worker"),
  worker: z.object({ configured: z.boolean(), healthReachable: z.boolean() }).strict(),
  missingObservabilityEnv: z.array(z.string().max(200)).max(50),
  timestamp: z.string().datetime(),
}).strict();
export const searchSuggestionsResponseSchema = z.object({
  suggestions: z.array(z.object({
    slug: z.string().min(1).max(300),
    name: z.string().min(1).max(300),
    minPrice: z.number().finite().nonnegative(),
    imageUrl: z.string().url().max(2_000).optional(),
  }).strict()).max(8),
  error: z.string().max(100).optional(),
  retryAfter: z.number().int().nonnegative().max(86_400).optional(),
}).strict();
export const catalogDefaultVariantResponseSchema = z.object({
  variantId: z.string().min(1).max(300),
  sku: z.string().max(300),
  price: z.number().finite().nonnegative().nullable(),
  currency: z.string().length(3),
}).strict();
const cartLineResponseSchema = z.object({
  variantId: z.string().min(1).max(300),
  quantity: z.number().int().positive().max(1_000),
  slug: z.string().max(300),
  name: z.string().max(500),
  sku: z.string().max(300),
  type: z.string().max(200),
  finish: z.string().max(200),
  price: z.number().finite().nonnegative(),
  currencyCode: z.string().length(3).optional(),
  thumbnail: z.string().max(2_000).optional(),
  availableQuantity: z.number().int().nonnegative().max(1_000_000).nullable().optional(),
}).strict();
export const cartResumeResponseSchema = z.object({
  lines: z.array(cartLineResponseSchema).max(100),
  cartId: z.string().max(300).nullable(),
  source: z.enum(["local", "server"]),
  available: z.boolean(),
  stale: z.boolean(),
  skipped: z.boolean().optional(),
  error: z.string().max(100).optional(),
}).strict();
export const loyaltyBalanceResponseSchema = z.object({
  balance: z.number().int().nonnegative().max(1_000_000_000),
  currency: z.literal("php"),
}).strict();
const customerLoyaltyAccountSchema = z.object({
  id: z.string().min(1).max(200),
  points_balance: z.number().int().nonnegative().max(1_000_000_000),
  lifetime_points: z.number().int().nonnegative().max(1_000_000_000),
  tier: z.string().min(1).max(80),
  updated_at: z.string().datetime(),
}).strict();
const customerLoyaltyTransactionSchema = z.object({
  id: z.string().min(1).max(200),
  points_delta: z.number().int().max(1_000_000_000).min(-1_000_000_000),
  reason: z.string().min(1).max(300),
  order_id: z.string().max(200).nullable(),
  created_at: z.string().datetime(),
}).strict();
export const customerLoyaltyResponseSchema = z.object({
  account: customerLoyaltyAccountSchema.nullable(),
  transactions: z.array(customerLoyaltyTransactionSchema).max(50),
}).strict();
const customerMarketingPreferenceSchema = z.object({
  channel: z.enum(["email", "order_updates", "back_in_stock", "promotions", "wallet", "platform_updates"]),
  consent_status: z.enum(["subscribed", "unsubscribed"]),
  source: z.string().min(1).max(120),
  consented_at: z.string().datetime().nullable(),
  unsubscribed_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime(),
}).strict();
export const accountMarketingPreferencesResponseSchema = z.object({
  preference: customerMarketingPreferenceSchema.nullable(),
  preferences: z.array(customerMarketingPreferenceSchema).max(6),
}).strict();
const customerOrderPreferenceSchema = z.object({
  organization_id: z.string().max(200).optional(),
  customer_email: z.string().email().max(320).optional(),
  out_of_stock_action: z.enum(["remove_and_continue", "cancel_order", "ask_me"]),
  updated_at: z.string().datetime().optional(),
}).strict();
export const accountOrderPreferencesResponseSchema = z.object({
  preference: customerOrderPreferenceSchema,
}).strict();
const storefrontWishlistItemResponseSchema = z.object({
  product_slug: z.string().min(1).max(240),
  product_name: z.string().min(1).max(500),
  medusa_product_id: z.string().min(1).max(200),
  added_at: z.string().datetime().or(z.string().min(1).max(120)),
}).strict();
export const wishlistResponseSchema = z.object({
  items: z.array(storefrontWishlistItemResponseSchema).max(200),
}).strict();
export const wishlistCreateResponseSchema = z.object({ ok: z.literal(true) }).strict();
export const wishlistDeleteResponseSchema = z.object({ ok: z.literal(true), removed: z.boolean() }).strict();
export const wishlistRequestSchema = z.object({ medusaProductId: z.string().trim().min(1).max(200) }).strict();
export const wishlistSyncRequestSchema = z.object({ items: z.array(z.object({ medusaProductId: z.string().trim().min(1).max(200) }).strict()).max(200) }).strict();
export const cartReconcileRequestSchema = z.object({ lines: z.array(z.object({ variantId: z.string().trim().min(1).max(200), quantity: z.number().int().min(1).max(999) }).strict()).max(50) }).strict();
export const cronBackInStockResponseSchema = z.object({
  ok: z.literal(true), sent: z.number().int().nonnegative().max(100), failed: z.number().int().nonnegative().max(100), inspected: z.number().int().nonnegative().max(100),
}).strict();
export const cronCampaignsResponseSchema = z.object({
  processed: z.number().int().nonnegative().max(1), scheduled: z.number().int().nonnegative().optional(), sent: z.number().int().nonnegative().max(100_000).optional(), failed: z.boolean().optional(), skipped: z.boolean().optional(), retrying: z.boolean().optional(),
}).strict();
export const cronInventoryReservationsResponseSchema = z.object({
  processed: z.number().int().nonnegative().max(10_000), expired: z.number().int().nonnegative().max(1_000_000),
}).strict();
const cronPaymentReconciliationResultSchema = z.object({
  source: z.literal("uvs_ledger"), provider: z.enum(["stripe", "paypal", "xendit"]), period_start: z.string().datetime(), period_end: z.string().datetime(),
  payment_attempts: z.number().int().nonnegative().max(1_000_000), settled_attempts: z.number().int().nonnegative().max(1_000_000), provider_artifacts: z.number().int().nonnegative().max(1_000_000), settled_artifacts: z.number().int().nonnegative().max(1_000_000),
  attempt_amount_minor: z.number().int().nonnegative(), artifact_amount_minor: z.number().int().nonnegative(), amount_delta_minor: z.number().int(), status: z.enum(["matched", "review"]), provider_api_pull: z.literal(false), reconciliation_mode: z.literal("worker_owned_handoff"), execution_owner: z.literal("cloudflare_worker"),
}).strict();
export const cronPaymentReconciliationResponseSchema = z.union([
  z.object({ processed: z.literal(0) }).strict(),
  z.object({ processed: z.literal(1), job_id: z.string().min(1).max(200), result: cronPaymentReconciliationResultSchema }).strict(),
]);
const checkoutIntentStateSchema = z.string().min(1).max(80);
export const checkoutIntentRecoveryResponseSchema = z.union([
  z.object({ found: z.literal(false) }).strict(),
  z.object({
    found: z.literal(true), correlationId: z.string().min(1).max(200), status: checkoutIntentStateSchema,
    checkoutState: checkoutIntentStateSchema, medusaOrderId: z.string().max(200).nullable().optional(),
  }).strict(),
]);
export const checkoutIntentResponseSchema = z.object({
  correlationId: z.string().min(1).max(200), cartId: z.string().min(1).max(200), provider: z.enum(["stripe", "paypal", "xendit"]),
  providerSessionId: z.string().max(500).nullable().optional(), providerPaymentId: z.string().max(500).nullable().optional(), status: checkoutIntentStateSchema,
  checkoutState: checkoutIntentStateSchema, quoteFingerprint: z.string().max(500).nullable().optional(), staleReason: z.string().max(500).nullable().optional(), medusaOrderId: z.string().max(200).nullable().optional(),
  trackingPageUrl: z.string().url().max(2_000).nullable(), lastError: z.string().max(2_000).nullable(), finalizeAttempts: z.number().int().nonnegative().max(100), updatedAt: z.string().datetime(),
}).strict();
export const accountProfilePatchResponseSchema = z.object({
  ok: z.literal(true), updatedAt: z.string().datetime().optional(),
}).strict();
export const backInStockResponseSchema = z.object({ ok: z.literal(true) }).strict();
const checkoutAddressResponseSchema = z.object({
  first_name: z.string().min(1).max(100), last_name: z.string().min(1).max(100), phone: z.string().min(1).max(40), address_1: z.string().min(1).max(200),
  address_2: z.string().max(200).optional(), city: z.string().min(1).max(100), province: z.string().min(1).max(100), country_code: z.string().length(2), postal_code: z.string().max(20).optional(),
}).strict();
export const checkoutCodCartPayloadResponseSchema = z.object({
  email: z.string().email().max(320), shipping_address: checkoutAddressResponseSchema, billing_address: checkoutAddressResponseSchema,
}).strict();
export const checkoutVerifyStockResponseSchema = z.union([
  z.object({ ok: z.literal(true) }).strict(),
  z.object({ ok: z.literal(false), message: z.string().min(1).max(500), code: z.enum(["INSUFFICIENT_STOCK", "INVENTORY_CHECK_FAILED"]), retryAfter: z.number().int().nonnegative().max(86_400).optional() }).strict(),
]);
export const checkoutApplyPromoResponseSchema = z.object({ ok: z.literal(true), discountAmount: z.number().finite().nonnegative().max(1_000_000_000) }).strict();
export const legacyRouteRetiredResponseSchema = z.object({
  error: z.string().min(1).max(500),
  code: z.literal("LEGACY_ROUTE_DISABLED"),
}).strict();
export const simpleOkResponseSchema = z.object({ ok: z.literal(true) }).strict();
export const newsletterConfirmResponseSchema = z.object({ ok: z.literal(true), suppressed: z.boolean().optional() }).strict();
export const cartLineMutationResponseSchema = z.object({ ok: z.literal(true), updated: z.number().int().nonnegative().max(100).optional(), removed: z.number().int().nonnegative().max(100).optional(), skipped: z.boolean().optional() }).strict();
export const cartBindResponseSchema = z.object({ ok: z.literal(true) }).strict();
export const cartMergeResponseSchema = z.object({ ok: z.literal(true), cartId: z.string().min(1).max(300), lines: z.array(cartLineResponseSchema).max(100), replayed: z.boolean().optional() }).strict();
const cartReconcileLineSchema = cartLineResponseSchema.extend({ status: z.enum(["current", "over_limit"]) }).strict();
export const cartReconcileResponseSchema = z.object({ ok: z.literal(true), reconciledAt: z.string().datetime(), lines: z.array(cartReconcileLineSchema).max(50), currency: z.string().length(3), cartTotal: z.number().finite().nonnegative() }).strict();
export const cartReconcileErrorResponseSchema = z.object({
  error: z.literal("Catalog reconciliation is temporarily unavailable"),
  lines: z.array(z.object({ variantId: z.string().min(1).max(200), status: z.literal("error") }).strict()).max(50),
}).strict();
export const checkoutStartResponseSchema = z.object({
  checkoutUrl: z.string().url().max(2_000), cartId: z.string().min(1).max(300), providerLabel: z.string().min(1).max(120), confirmedTotal: z.number().finite().nonnegative(), currencyCode: z.string().regex(/^[A-Z]{3,8}$/),
  paymentSessionId: z.string().min(1).max(500), providerPaymentId: z.string().min(1).max(500), quoteFingerprint: z.string().min(1).max(512), variantIds: z.array(z.string().max(200)).max(500), productIds: z.array(z.string().max(200)).max(500), checkoutActionKind: z.literal("redirect"), correlationId: z.string().min(1).max(200), workerCheckout: z.literal(true),
}).strict();
export const cmsFormSubmissionResponseSchema = z.object({
  ok: z.literal(true),
  id: z.string().min(1).max(200).optional(),
  delivery: z.literal("recorded").optional(),
}).strict();
export const cronFinalizePaymentAttemptsResponseSchema = z.object({
  ok: z.literal(true),
  processed: z.number().int().nonnegative().max(100),
  completed: z.number().int().nonnegative().max(100),
  errors: z.array(z.string().min(1).max(2_200)).max(100),
}).strict();
export const posCommerceDraftOrderResponseSchema = z.object({
  draftOrderId: z.string().min(1).max(300),
  displayId: z.string().min(1).max(300),
}).strict();
export const posCommerceCommitSaleResponseSchema = z.object({
  orderNumber: z.string().min(1).max(300),
  orderId: z.string().min(1).max(300),
  idempotent: z.boolean(),
}).strict();
export const paypalConfirmationResponseSchema = z.object({
  ok: z.literal(true),
  provider: z.object({
    ok: z.literal(true),
    correlationId: z.string().min(1).max(200),
    captureId: z.string().min(1).max(300).optional(),
  }).strict(),
}).strict();
export const cmsPreviewResponseSchema = z.union([
  z.object({ kind: z.literal("page"), data: z.lazy(() => adminCmsPageResponseSchema.shape.data) }).strict(),
  z.object({ kind: z.literal("blog"), data: z.lazy(() => adminCmsBlogResponseSchema.shape.data) }).strict(),
]);
export const devDiagnosticsResponseSchema = z.object({
  diagnostics: z.object({
    process: z.object({
      pid: z.number().int().positive(), uptimeSeconds: z.number().finite().nonnegative(),
      rssBytes: z.number().int().nonnegative(), heapUsedBytes: z.number().int().nonnegative(),
      heapTotalBytes: z.number().int().nonnegative(), externalBytes: z.number().int().nonnegative(),
      arrayBuffersBytes: z.number().int().nonnegative(),
    }).strict(),
    eventLoop: z.object({
      sampleMs: z.number().int().min(10).max(100), meanMs: z.number().finite().nonnegative().nullable(),
      maxMs: z.number().finite().nonnegative().nullable(), p99Ms: z.number().finite().nonnegative().nullable(),
    }).strict(),
    activeSseClients: z.number().int().nonnegative().max(10_000),
  }).strict(),
}).strict();
export const internalReconcilePaymentAttemptResponseSchema = z.union([
  z.object({ ok: z.literal(true), orderId: z.string().min(1).max(300), redirectUrl: z.string().url().max(2_000) }).strict(),
  z.object({ ok: z.literal(false), error: z.string().min(1).max(2_000) }).strict(),
]);
export const nangoWebhookResponseSchema = z.object({
  accepted: z.literal(true), deduplicated: z.literal(true).optional(),
}).strict();
export const checkoutIntentRegistrationResponseSchema = z.object({
  correlationId: z.string().min(1).max(200),
  reused: z.boolean().optional(),
  provider: z.string().min(1).max(80).optional(),
}).passthrough();
export const checkoutIntentFinalizeResponseSchema = z.object({
  orderId: z.string().min(1).max(300),
  redirectUrl: z.string().url().max(2_000),
}).passthrough();
export const codPlaceOrderResponseSchema = z.object({ ok: z.literal(true), orderId: z.string().min(1).max(200), redirectUrl: z.string().url().max(2_000) }).strict();
export const trackingLinkResponseSchema = z.object({ trackingPageUrl: z.string().url().max(2_000) }).strict();
export const reviewHelpfulResponseSchema = z.object({ ok: z.literal(true), helpful_votes: z.number().int().nonnegative().max(1_000_000) }).strict();
export const accountPrivacyErasureResponseSchema = z.object({ ok: z.literal(true) }).strict();
export const cartAttachCustomerResponseSchema = z.union([
  z.object({ ok: z.literal(false), skipped: z.literal(true) }).strict(),
  z.object({ ok: z.literal(true), cartId: z.string().min(1).max(300) }).strict(),
]);
const cancelledOrderResponseSchema = z.object({ id: z.string().min(1).max(200), customer_id: z.string().max(200).nullable().optional(), email: z.string().email().max(320).nullable().optional(), status: z.enum(["canceled", "cancelled"]) }).strict();
export const accountOrderCancelResponseSchema = z.union([
  z.object({ ok: z.literal(true), already_canceled: z.literal(true) }).strict(),
  z.object({ ok: z.literal(true), order: cancelledOrderResponseSchema }).strict(),
]);
export const commerceTelemetryResponseSchema = z.object({ ok: z.literal(true) }).strict();
export const commerceInvalidationResponseSchema = z.object({
  ok: z.literal(true), scope: z.enum(["commerce", "cms"]), classification: z.enum(["editorial_only", "merchandising_only", "sellability_affecting", "checkout_affecting"]),
  revalidatedTags: z.array(z.string().max(300)).max(100), revalidatedPaths: z.array(z.string().max(500)).max(100), invalidatedAttempts: z.number().int().nonnegative().max(200),
}).strict();
const boundedExportArraysSchema = z.record(z.string().max(120), z.array(z.unknown()).max(5_000)).superRefine((value, ctx) => { if (Object.keys(value).length > 20) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Too many export collections" }); });
export const accountPrivacyExportResponseSchema = z.object({
  email: z.string().email().max(320), exportedAt: z.string().datetime(), app: boundedExportArraysSchema,
  medusa: z.object({ customer: z.unknown().nullable(), orders: z.array(z.unknown()).max(5_000), orderItems: z.array(z.unknown()).max(10_000), addresses: z.array(z.unknown()).max(5_000), payments: z.array(z.unknown()).max(5_000) }).strict(),
  limits: z.record(z.string().max(120), z.number().int().nonnegative().max(10_000)).superRefine((value, ctx) => { if (Object.keys(value).length > 30) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Too many export limits" }); }),
}).strict();
export const paymentReceiptUploadResponseSchema = z.object({ ok: z.literal(true), receiptId: z.string().min(1).max(200), url: z.string().url().max(2_000).nullable() }).strict();
export const publicFeatureMappingsResponseSchema = z.object({
  data: z.array(z.object({
    key: z.string().min(1).max(200),
    domain: z.string().min(1).max(100),
    label: z.string().min(1).max(300),
    status: z.enum(["implemented", "partial", "planned"]),
    storefrontSurfaces: z.array(z.string().max(300)).max(100),
    ossOrProvider: z.array(z.object({
      name: z.string().min(1).max(200),
      role: z.string().min(1).max(500),
      url: z.string().url().max(2_000),
    }).strict()).max(20),
    notes: z.string().max(2_000),
  }).strict()).max(100),
}).strict();
export const reviewCsrfResponseSchema = z.object({ token: z.string().min(20).max(512) }).strict();
const storefrontReviewRowSchema = z.object({
  id: z.string().min(1).max(200), rating: z.number().int().min(1).max(5), author_name: z.string().max(120), image_url: z.string().max(8192).nullable(),
  body: z.string().max(2_000), created_at: z.string().datetime(), product_slug: z.string().min(1).max(240), medusa_product_id: z.string().max(200).nullable(),
  is_verified_buyer: z.boolean(), helpful_votes: z.number().int().nonnegative().max(1_000_000),
}).strict();
export const storefrontReviewsResponseSchema = z.object({ reviews: z.array(storefrontReviewRowSchema).max(100), nextCursor: z.string().max(500).nullable() }).strict();
export const storefrontReviewCreateResponseSchema = z.object({ ok: z.literal(true), status: z.literal("pending"), isVerifiedBuyer: z.boolean() }).strict();
const boundedProductMetadataSchema = z.record(z.string().max(128), z.unknown()).superRefine((value, ctx) => {
  if (Object.keys(value).length > 100) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Product metadata has too many fields" });
});
const storefrontProductVariantResponseSchema = z.object({
  id: z.string().min(1).max(200), productId: z.string().min(1).max(200), sku: z.string().max(160), barcode: z.string().max(160).nullable(),
  type: z.string().max(120), finish: z.string().max(120), pickupConfig: z.string().max(120), bodyWood: z.string().max(120), condition: z.string().max(120),
  skillLevel: z.string().max(120), shippingSpeed: z.string().max(120), price: z.number().finite().nonnegative(), currencyCode: z.string().max(12).optional(),
  compareAtPrice: z.number().finite().nonnegative().nullable(), cost: z.null(), manageInventory: z.boolean(), inventoryQuantity: z.number().int().nonnegative().nullable(), isActive: z.boolean(),
}).strict();
const storefrontProductResponseSchema = z.object({
  id: z.string().min(1).max(200), slug: z.string().min(1).max(240), name: z.string().min(1).max(240), description: z.string().max(100_000).nullable(),
  category: z.string().max(200).nullable(), status: z.string().max(80), brand: z.string().max(200).nullable(), createdAt: z.string().datetime().nullable(),
  images: z.array(z.object({ id: z.string().max(200), productId: z.string().max(200), imageUrl: z.string().max(8192), sortOrder: z.number().int().nonnegative(), altText: z.string().max(500).optional() }).strict()).max(100),
  gallerySlides: z.array(z.union([z.object({ kind: z.literal("image"), url: z.string().max(8192), altText: z.string().max(500).optional() }).strict(), z.object({ kind: z.literal("video"), url: z.string().max(8192) }).strict()])).max(100),
  variants: z.array(storefrontProductVariantResponseSchema).max(500), videoUrl: z.string().max(8192).nullable(), weightKg: z.number().finite().nonnegative().nullable(), dimensionsLabel: z.string().max(200).nullable(),
  material: z.string().max(200).nullable(), lifestyleImageUrl: z.string().max(8192).nullable(), hotspots: z.array(z.object({ xPct: z.number().finite().min(0).max(100), yPct: z.number().finite().min(0).max(100), productSlug: z.string().max(240), label: z.string().max(200).optional() }).strict()).max(100),
  relatedHandles: z.array(z.string().max(240)).max(100), seoDescription: z.string().max(10_000).nullable(), guitarSpecs: boundedProductMetadataSchema.nullable(),
  audioDemos: z.array(z.object({ url: z.string().max(8192), title: z.string().max(240), description: z.string().max(2_000).optional(), durationSeconds: z.number().finite().nonnegative().optional() }).strict()).max(100),
  trustContent: boundedProductMetadataSchema.nullable(),
}).strict();
export const shopProductResponseSchema = z.object({ product: storefrontProductResponseSchema }).strict();
export const cartBindTokenResponseSchema = z.object({ token: z.string().trim().min(16).max(512) }).strict();
const cmsPageMutationResponseRowSchema = z.object({
  id: z.string().uuid(), page_id: z.string().uuid(), organization_id: z.string().min(1).max(200), revision: z.number().int().positive(), sequence: z.number().int().nonnegative(),
  mutation: z.record(z.string().max(128), z.unknown()).superRefine((value, ctx) => { if (Object.keys(value).length > 100) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Mutation has too many fields" }); }),
  created_at: z.string().datetime(),
}).strict();
export const cmsPageMutationsResponseSchema = z.object({ data: z.array(cmsPageMutationResponseRowSchema).max(1_000) }).strict();
const adminProductCategorySchema = z.object({ id: z.string(), name: z.string(), handle: z.string() }).strict();
export const adminCatalogCategoriesResponseSchema = z.object({ categories: z.array(adminProductCategorySchema).max(500) }).strict();
export const adminCatalogCategoryCreateResponseSchema = z.object({ category: adminProductCategorySchema }).strict();
const adminChannelEventRowSchema = z.object({
  id: z.string().min(1).max(200),
  channel: z.string().min(1).max(256),
  event_type: z.string().min(1).max(256),
  received_at: z.string(),
  processed_at: z.string().nullable(),
}).strict();
export const adminChannelEventsResponseSchema = z.object({ events: z.array(adminChannelEventRowSchema).max(100) }).strict();
export const adminChannelEventProcessResponseSchema = z.object({ event: z.object({ id: z.string().uuid(), processed_at: z.string().datetime(), alreadyProcessed: z.boolean() }).strict() }).strict();
export const adminCatalogProductSuggestionsResponseSchema = z.object({
  items: z.array(z.object({ id: z.string(), title: z.string(), handle: z.string() }).strict()).max(30),
}).strict();
export const adminChatOrderVariantSuggestionsResponseSchema = z.object({
  lines: z.array(z.object({
    variantId: z.string().min(1).max(200), label: z.string().min(1).max(400),
    productTitle: z.string().min(1).max(240), sku: z.string().max(160).nullable(),
  }).strict()).max(40),
}).strict();
export const adminPosDeviceResponseSchema = z.object({
  id: z.string(), name: z.string(), type: z.enum(["terminal", "printer", "kds", "scanner"]), ip_address: z.string().nullable(),
  is_active: z.boolean(), config: z.record(z.string(), z.unknown()), last_seen_at: z.string().datetime().nullable(), created_at: z.string().datetime(),
}).strict();
export const adminDevicesResponseSchema = z.object({ data: z.array(adminPosDeviceResponseSchema).max(500) }).strict();
export const adminDeviceResponseEnvelopeSchema = z.object({ data: adminPosDeviceResponseSchema }).strict();
export const adminDevicePatchSchema = z.object({ ip_address: z.string().trim().max(64).nullable().optional(), config: z.record(z.string(), z.unknown()).optional(), is_active: z.boolean().optional() }).strict().refine((value) => Object.keys(value).length > 0, { message: "At least one device field is required" });
const adminPosFeatureMappingSchema = z.object({
  key: z.enum(["order_tag", "e_invoice", "receipt", "customer_attribution"]), label: z.string(), description: z.string(),
  destination: z.enum(["medusa_order_metadata", "receipt_service", "crm_bridge"]),
  adminRoutes: z.array(z.string()),
  providerMappings: z.array(z.object({ provider: z.literal("pancake_pos"), readEndpoint: z.string(), writeEndpoint: z.string().optional(), purpose: z.string() }).strict()).optional(),
}).strict();
export const adminPosFeatureMappingsResponseSchema = z.object({ data: z.array(adminPosFeatureMappingSchema).max(100) }).strict();
const adminCatalogSuggestionVariantSchema = z.object({ id: z.string().optional(), sku: z.string().optional() }).strict();
const adminCatalogSuggestionCategorySchema = z.object({ id: z.string().optional(), name: z.string().optional() }).strict();
const adminCatalogSearchProductSchema = z.object({
  id: z.string(), title: z.string(), handle: z.string(), status: z.string(), thumbnail: z.string().nullable(),
  variants: z.array(adminCatalogSuggestionVariantSchema), categories: z.array(adminCatalogSuggestionCategorySchema),
}).strict();
export const adminCommerceProductSearchResponseSchema = z.object({
  data: z.object({ products: z.array(adminCatalogSearchProductSchema).max(30), count: z.number().int().nonnegative() }).strict(),
}).strict();
export const adminCommerceProductLookupResponseSchema = z.object({
  data: z.object({ products: z.array(z.object({ id: z.string(), title: z.string(), handle: z.string(), sku: z.string(), status: z.string(), thumbnail_url: z.string().nullable(), category_ids: z.array(z.string()) }).strict()).max(500) }).strict(),
}).strict();
const posCommerceProductSchema = z.object({
  variantId: z.string().trim().min(1).max(200), name: z.string().max(240), sku: z.string().max(160), barcode: z.string().max(160).optional(),
  size: z.string().max(80), color: z.string().max(80), price: z.number().finite().nonnegative().max(1_000_000),
  imageUrl: z.string().trim().max(8192).refine((value) => value.startsWith("/") || /^https?:\/\//i.test(value), "Invalid image URL").optional(),
}).strict();
export const adminPosCommerceLookupResponseSchema = z.object({
  id: z.string().min(1).max(200), sku: z.string().max(160), barcode: z.string().max(160).optional(), size: z.string().max(80), color: z.string().max(80),
  price: z.number().finite().nonnegative().max(1_000_000), products: z.object({ name: z.string().max(240) }).strict(), imageUrl: z.string().max(8192).optional(),
}).strict();
export const adminChannelWebhookResponseSchema = z.object({ ok: z.literal(true), deduplicated: z.literal(true).optional() }).strict();
export const adminCourierTelemetryResponseSchema = z.object({
  data: z.record(z.string().max(128), z.unknown()).superRefine((value, ctx) => { if (Object.keys(value).length > 40) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Telemetry row is too large" }); }),
}).strict();
const boundedDeliveryOperationDataSchema = z.record(z.string().max(128), z.unknown()).superRefine((value, ctx) => {
  if (Object.keys(value).length > 100) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Delivery operation result is too large" });
});
export const adminDeliveryOperationMutationResponseSchema = z.object({ data: boundedDeliveryOperationDataSchema }).strict();
const boundedDeliveryLogisticsRowsSchema = z.array(z.record(z.string().max(128), z.unknown())).max(200);
export const adminDeliveryLogisticsResponseSchema = z.object({
  ok: z.literal(true),
  overview: z.object({
    coverage: z.object({ total: z.number().int().nonnegative(), covered: z.number().int().nonnegative(), partial: z.number().int().nonnegative(), planned: z.number().int().nonnegative() }).strict(),
    checklist: z.array(z.record(z.string().max(128), z.unknown())).max(50),
    supportedApps: z.array(z.record(z.string().max(128), z.unknown())).max(50),
    couriers: boundedDeliveryLogisticsRowsSchema,
    openExceptions: z.array(z.record(z.string().max(128), z.unknown())).max(200),
    shipments: z.array(z.record(z.string().max(128), z.unknown())).max(25),
    events: z.array(z.record(z.string().max(128), z.unknown())).max(25),
    operationalSignals: z.object({ activeOrders: z.number().int().nonnegative(), shipmentDue: z.number().int().nonnegative(), recordedShipments: z.number().int().nonnegative(), recentEvents: z.number().int().nonnegative(), trackingLinksEnabled: z.boolean(), codDeliveredPendingCapture: z.number().int().nonnegative(), pancakePosConfigured: z.boolean(), smsConfigured: z.boolean() }).strict(),
  }).strict(),
}).strict();
export const posCommerceQuickProductsResponseSchema = z.object({ products: z.array(posCommerceProductSchema).max(4) }).strict();
export const posCommerceSearchResponseSchema = z.object({ products: z.array(posCommerceProductSchema).max(24) }).strict();
export const posCommerceSuggestionsResponseSchema = z.object({ suggestions: z.array(posCommerceProductSchema).max(8) }).strict();
export const adminCommerceRecoveryMetricsResponseSchema = z.object({
  days: z.number().int().min(1).max(90), buckets: z.array(z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), count: z.number().int().nonnegative() }).strict()), totalInvalidationsInWindow: z.number().int().nonnegative(),
}).strict();
const adminLoyaltyAccountResponseSchema = z.object({
  id: z.string(), customer_email: z.string().email(), medusa_customer_id: z.string().nullable(), points_balance: z.number().finite(), lifetime_points: z.number().finite(),
  tier: z.enum(["standard", "silver", "gold", "platinum"]), birthday: z.string().nullable(), phone: z.string().nullable(), qr_token: z.string().nullable(), created_at: z.string(), updated_at: z.string(),
}).strict();
const adminLoyaltyRewardResponseSchema = z.object({
  id: z.string(), name: z.string(), description: z.string().nullable(), points_cost: z.number().finite(), reward_type: z.enum(["discount", "free_item", "free_shipping", "custom"]), reward_value: z.record(z.string(), z.unknown()), is_active: z.boolean(), created_at: z.string(),
}).strict();
const adminOfflineQueueItemSchema = z.object({
  id: z.string(), device_name: z.string(), employee_id: z.string().nullable(), payload: z.record(z.string(), z.unknown()), status: z.enum(["pending", "synced", "failed"]), error_message: z.string().nullable(), created_at: z.string(), synced_at: z.string().nullable(),
}).strict();
export const adminLoyaltyAccountsResponseSchema = z.object({ data: z.array(adminLoyaltyAccountResponseSchema).max(500) }).strict();
export const adminLoyaltyAccountResponseEnvelopeSchema = z.object({ data: adminLoyaltyAccountResponseSchema }).strict();
export const adminLoyaltyRewardsResponseSchema = z.object({ data: z.array(adminLoyaltyRewardResponseSchema).max(500) }).strict();
export const adminLoyaltyRewardResponseEnvelopeSchema = z.object({ data: adminLoyaltyRewardResponseSchema }).strict();
export const adminOfflineQueueResponseSchema = z.object({ data: z.array(adminOfflineQueueItemSchema).max(100) }).strict();
export const adminOfflineQueueItemResponseSchema = z.object({ data: adminOfflineQueueItemSchema }).strict();
export const adminOfflineQueueMutationResponseSchema = z.object({ success: z.literal(true) }).strict();
const storefrontProfileStatusSchema = z.object({
  displayName: z.string().nullable(), phone: z.string().nullable(), avatarUrl: z.string().nullable(), shippingAddresses: z.array(z.unknown()), updatedAt: z.string().nullable().optional(),
}).strict();
export const accountProfileStatusResponseSchema = z.union([
  z.object({ authenticated: z.literal(false), complete: z.literal(false) }).strict(),
  z.object({ authenticated: z.literal(true), available: z.literal(false), error: z.string() }).strict(),
  z.object({ authenticated: z.literal(true), available: z.literal(true), complete: z.boolean(), missingFields: z.array(z.string()), profile: storefrontProfileStatusSchema.nullable() }).strict(),
]);
const adminInventoryRowSchema = z.object({ variantId: z.string(), productId: z.string(), productName: z.string(), sku: z.string(), size: z.string(), color: z.string(), available: z.number().finite() }).strict();
const adminPaginationSchema = z.object({ page: z.number().int().positive(), pageSize: z.number().int().positive(), total: z.number().int().nonnegative(), totalPages: z.number().int().positive(), hasNextPage: z.boolean(), hasPreviousPage: z.boolean() }).strict();
export const adminInventoryResponseSchema = z.object({ rows: z.array(adminInventoryRowSchema).max(100), ...adminPaginationSchema.shape }).strict();
export const adminInventoryAdjustmentResponseSchema = z.object({ data: z.object({ productId: z.string().min(1).max(200), variantId: z.string().min(1).max(200), locationId: z.string().min(1).max(200), stockedQuantity: z.number().int().nonnegative().max(1_000_000), availableQuantity: z.number().int().nonnegative().max(1_000_000), delta: z.number().int().max(1_000_000).min(-1_000_000), reason: z.string().min(1).max(32) }).strict() }).strict();
const adminInventoryStreamDataSchema = z.object({
  rows: z.array(adminInventoryRowSchema).max(100),
  page: z.number().int().min(1).max(1_000_000),
  pageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]),
  total: z.number().int().nonnegative().max(10_000_000),
}).strict();
const adminInventoryStreamErrorSchema = z.object({
  code: z.literal("INVENTORY_STREAM_FAILED"),
  retryable: z.literal(true),
}).strict();
export const adminInventoryStreamResponseSchema = z.union([
  adminInventoryStreamDataSchema,
  adminInventoryStreamErrorSchema,
]);
const adminInventoryLedgerRowSchema = z.object({
  id: z.string(),
  created_at: z.string().datetime(),
  actor_email: z.string().email().nullable(),
  reason: z.string(),
  reference_type: z.string(),
  reference_id: z.string(),
  product_id: z.string(),
  variant_id: z.string(),
  location_id: z.string().nullable(),
  quantity_before: z.number().int().nullable(),
  quantity_after: z.number().int(),
  quantity_delta: z.number().int(),
  correlation_id: z.string().nullable(),
}).strict();
export const adminInventoryLedgerResponseSchema = z.object({
  data: z.array(adminInventoryLedgerRowSchema).max(200),
  organization_id: z.string(),
}).strict();
const adminInventoryCycleCountLineSchema = z.union([
  z.object({
    id: z.string().uuid(),
    cycle_count_id: z.string().uuid(),
    product_id: z.string(),
    variant_id: z.string(),
    expected_quantity: z.number().int().nonnegative(),
    counted_quantity: z.number().int().nonnegative().nullable(),
    created_at: z.string().datetime(),
  }).strict(),
  z.object({
    productId: z.string(),
    variantId: z.string(),
    expectedQuantity: z.number().int().nonnegative(),
    countedQuantity: z.number().int().nonnegative().nullable(),
  }).strict(),
]);
const adminInventoryCycleCountSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string(),
  location_id: z.string(),
  status: z.enum(["open", "processing", "completed", "failed", "cancelled"]),
  revision: z.number().int().positive(),
  idempotency_key: z.string(),
  failure_code: z.string().nullable(),
  failure_message: z.string().nullable(),
  created_by_email: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
  inventory_cycle_count_lines: z.array(adminInventoryCycleCountLineSchema).max(500).optional(),
}).strict();
const adminInventoryPurchaseOrderLineSchema = z.union([
  z.object({
    id: z.string().uuid(),
    purchase_order_id: z.string().uuid(),
    product_id: z.string(),
    variant_id: z.string(),
    ordered_quantity: z.number().int().positive(),
    received_quantity: z.number().int().nonnegative(),
    unit_cost_minor: z.number().int().nonnegative(),
    created_at: z.string().datetime(),
  }).strict(),
  z.object({
    productId: z.string(),
    variantId: z.string(),
    orderedQuantity: z.number().int().positive(),
    unitCostMinor: z.number().int().nonnegative(),
    receivedQuantity: z.number().int().nonnegative(),
  }).strict(),
]);
const adminInventoryPurchaseOrderSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string(),
  supplier_name: z.string(),
  destination_location_id: z.string(),
  currency_code: z.literal("PHP"),
  status: z.enum(["draft", "submitted", "partially_received", "received", "receiving", "receive_failed", "cancelled"]),
  revision: z.number().int().positive(),
  idempotency_key: z.string(),
  failure_code: z.string().nullable(),
  failure_message: z.string().nullable(),
  created_by_email: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  inventory_purchase_order_lines: z.array(adminInventoryPurchaseOrderLineSchema).max(100).optional(),
}).strict();
export const adminInventoryCycleCountsResponseSchema = z.object({
  data: z.array(adminInventoryCycleCountSchema).max(200),
  organizationId: z.string(),
}).strict();
export const adminInventoryCycleCountResponseSchema = z.object({
  data: adminInventoryCycleCountSchema,
}).strict();
export const adminInventoryPurchaseOrdersResponseSchema = z.object({
  data: z.array(adminInventoryPurchaseOrderSchema).max(200),
  organizationId: z.string(),
}).strict();
export const adminInventoryPurchaseOrderResponseSchema = z.object({
  data: adminInventoryPurchaseOrderSchema,
}).strict();
const adminInventoryReservationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  locationId: z.string(),
  inventoryItemId: z.string(),
  quantity: z.number().int().positive(),
  status: z.enum(["active", "released", "committed", "expired"]),
  referenceType: z.string().nullable(),
  referenceId: z.string().nullable(),
  medusaReservationId: z.string().nullable(),
  reservedAt: z.string().datetime(),
  releasedAt: z.string().datetime().nullable(),
  committedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  expiredAt: z.string().datetime().nullable(),
  reconciliationStatus: z.string().nullable(),
}).strict();
export const adminInventoryReservationsResponseSchema = z.object({
  data: z.array(adminInventoryReservationSchema).max(200),
  organizationId: z.string(),
}).strict();
export const adminInventoryReservationResponseSchema = z.object({
  data: adminInventoryReservationSchema,
}).strict();
const wishlistItemResponseSchema = z.object({
  product_slug: z.string(),
  product_name: z.string(),
  medusa_product_id: z.string(),
  added_at: z.string().datetime().or(z.string().min(1)),
}).strict();
export const wishlistSyncResponseSchema = z.object({
  ok: z.literal(true),
  items: z.array(wishlistItemResponseSchema).max(200),
  skippedProductIds: z.array(z.string()).max(200),
}).strict();
const adminPaymentAttemptSummarySchema = z.object({
  id: z.string(), correlationId: z.string(), cartId: z.string(), provider: z.string(), status: z.string(), checkoutState: z.string(), amountMinor: z.number().finite().nullable(), currency: z.string().nullable(), medusaOrderId: z.string().nullable(), quoteFingerprint: z.string().nullable(), staleReason: z.string().nullable(), invalidatedAt: z.string().nullable(), invalidatedBy: z.string().nullable(), providerSessionId: z.string().nullable(), lastError: z.string().nullable(), finalizeAttempts: z.number().int().nonnegative(), webhookLastStatus: z.string().nullable(), updatedAt: z.string(), finalizedAt: z.string().nullable(),
}).strict();
export const adminPaymentsResponseSchema = z.object({ attempts: z.array(adminPaymentAttemptSummarySchema).max(200) }).strict();
const adminAuditLogEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  resource: z.string(),
  details: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string().datetime(),
  actor_id: z.string().nullable(),
  users: z.object({ email: z.string().email().nullable(), name: z.string().nullable() }).nullable(),
}).strict();
export const adminAuditLogsResponseSchema = z.object({
  entries: z.array(adminAuditLogEntrySchema).max(500),
}).strict();
const adminWorkflowEntityRowSchema = z.object({
  id: z.string(),
  entity_type: z.string(),
  entity_id: z.string(),
  state: z.string(),
  previous_state: z.string().nullable(),
  notes: z.string().nullable(),
  actor_email: z.string().email().nullable(),
  updated_at: z.string().datetime(),
}).strict();
export const adminWorkflowEntitiesResponseSchema = z.object({
  rows: z.array(adminWorkflowEntityRowSchema).max(200),
}).strict();
export const adminWorkflowTransitionResponseSchema = z.object({ state: z.string().min(1).max(80) }).strict();
export const adminPinApprovalResponseSchema = z.object({
  approved: z.boolean(), reason: z.enum(["employee_not_found", "employee_inactive", "insufficient_role", "no_pin_set", "invalid_pin"]).optional(),
}).strict();
const adminCostLineItemSchema = z.object({
  service: z.string(),
  category: z.enum(["hosting", "database", "cache", "psp_fees", "email", "tracking", "cdn", "other"]),
  monthlyCostPhp: z.number().finite().nonnegative().nullable(),
  costStatus: z.enum(["not_configured", "estimated", "verified"]),
  note: z.string(),
}).strict();
export const adminCostVisibilityResponseSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  dataStatus: z.enum(["not_configured", "partial", "verified"]),
  totalMonthlyCostPhp: z.number().finite().nonnegative().nullable(),
  items: z.array(adminCostLineItemSchema).max(50),
  breakdown: z.record(z.string(), z.number().finite().nonnegative()),
}).strict();
const cmsAnnouncementResponseRowSchema = z.object({
  id: z.string(), body: z.string(), bodyFormat: z.enum(["plain", "html"]),
  linkUrl: z.string().nullable(), linkLabel: z.string().nullable(), dismissible: z.boolean(),
  startsAt: z.string().nullable(), endsAt: z.string().nullable(), locale: z.string(),
  priority: z.number().int(), stackGroup: z.string().nullable(), regionCode: z.string().nullable(),
}).strict();
const cmsAnnouncementAnalyticsSchema = z.record(z.string(), z.object({
  impressions: z.number().int().nonnegative(), clicks: z.number().int().nonnegative(), dismisses: z.number().int().nonnegative(),
}).strict());
export const adminCmsAnnouncementResponseSchema = z.object({
  data: z.object({ rows: z.array(cmsAnnouncementResponseRowSchema).max(500), analytics: cmsAnnouncementAnalyticsSchema }).strict(),
}).strict();
const cmsOutputNavLinkSchema: z.ZodType<unknown> = z.lazy(() => z.object({
  href: z.string(), label: z.string(), badge: z.string().optional(), iconKey: z.string().optional(),
  startsAt: z.string().optional(), endsAt: z.string().optional(),
  featured: z.object({ href: z.string(), label: z.string(), imageUrl: z.string().optional() }).strict().optional(),
  children: z.array(cmsOutputNavLinkSchema).max(50).optional(),
}).strict());
const cmsOutputNavigationPayloadSchema = z.object({
  headerLinks: z.array(cmsOutputNavLinkSchema).max(100),
  headerLinksMobile: z.array(cmsOutputNavLinkSchema).max(100),
  footerColumns: z.array(z.object({ title: z.string(), links: z.array(cmsOutputNavLinkSchema).max(100) }).strict()).max(50),
  footerBottomLinks: z.array(cmsOutputNavLinkSchema).max(100),
  socialLinks: z.array(z.object({ href: z.string(), label: z.string(), network: z.string().optional() }).strict()).max(50),
}).strict();
export const adminCmsNavigationResponseSchema = z.object({
  data: cmsOutputNavigationPayloadSchema,
  meta: z.object({ hasDraft: z.boolean() }).strict(),
}).strict();
const cmsPresetBlockResponseSchema = z.object({
  id: z.string(), type: z.string(), props: z.record(z.string(), z.unknown()),
}).strict();
const cmsPresetRowResponseSchema = z.object({
  id: z.string(), name: z.string(), blocks: z.array(cmsPresetBlockResponseSchema).max(100), created_at: z.string(),
}).strict();
export const adminCmsBlockPresetsResponseSchema = z.object({ data: z.array(cmsPresetRowResponseSchema).max(500) }).strict();
export const adminCmsBlockPresetResponseSchema = z.object({ data: cmsPresetRowResponseSchema }).strict();
const cmsRedirectResponseRowSchema = z.object({
  id: z.string(), from_path: z.string(), to_path: z.string(), status_code: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]),
  active: z.boolean(), preserve_query: z.boolean(), created_at: z.string(),
}).strict();
export const adminCmsRedirectsResponseSchema = z.object({ data: z.array(cmsRedirectResponseRowSchema).max(5_000) }).strict();
export const adminCmsRedirectResponseSchema = z.object({ data: cmsRedirectResponseRowSchema }).strict();
export const adminCmsRedirectBulkResponseSchema = z.object({
  data: z.object({ updated: z.number().int().min(0).max(200) }).strict(),
}).strict();
export const adminCmsRedirectImportResponseSchema = z.object({
  data: z.object({
    imported: z.number().int().min(0).max(1_000),
    warnings: z.array(z.string().max(500)).max(100),
  }).strict(),
}).strict();
const cmsRedirectChainItemSchema = cmsRedirectResponseRowSchema.pick({ from_path: true, to_path: true, status_code: true, preserve_query: true });
const cmsRedirectResolveBaseSchema = z.object({ chain: z.array(cmsRedirectChainItemSchema).max(16), duplicate_from_warnings: z.array(z.string()).max(5_000) }).strict();
export const adminCmsRedirectResolveResponseSchema = z.object({ data: z.union([
  cmsRedirectResolveBaseSchema.extend({ loop: z.literal(true), resolved: z.boolean().optional(), final_path: z.string().optional(), final_url: z.string().optional(), status_code: z.number().int().optional() }).strict(),
  cmsRedirectResolveBaseSchema.extend({ resolved: z.literal(false), final_path: z.string() }).strict(),
  cmsRedirectResolveBaseSchema.extend({ resolved: z.literal(true), final_url: z.string(), status_code: z.number().int() }).strict(),
]) }).strict();
const cmsPageBlockResponseSchema = z.record(z.string().max(80), z.unknown());
const cmsPageNodeResponseSchema = z.record(z.string().max(80), z.unknown());
const cmsPageResponseRowSchema = z.object({
  id: z.string().min(1).max(200), organization_id: z.string().nullable(),
  slug: z.string().min(1).max(160), locale: z.string().min(2).max(16),
  page_type: z.enum(["static", "landing", "legal"]), title: z.string().max(240),
  body: z.string().max(500_000),
  blocks: z.array(cmsPageBlockResponseSchema).max(200),
  tree: z.array(cmsPageNodeResponseSchema).max(1_000),
  mutations: z.array(z.record(z.string().max(80), z.unknown())).max(500).optional(),
  status: z.enum(["draft", "published", "scheduled"]),
  published_at: z.string().nullable(), scheduled_publish_at: z.string().nullable(),
  preview_token: z.string().nullable(), meta_title: z.string().nullable(),
  meta_description: z.string().nullable(), canonical_url: z.string().nullable(),
  og_image_url: z.string().nullable(), json_ld: z.unknown().nullable(),
  version: z.number().int().positive(), created_at: z.string(), updated_at: z.string(),
  parent_slug: z.string().nullable(), breadcrumb_label: z.string().nullable(),
}).strict();
export const adminCmsPagesResponseSchema = z.object({ data: z.array(cmsPageResponseRowSchema).max(500) }).strict();
export const adminCmsPageResponseSchema = z.object({ data: cmsPageResponseRowSchema }).strict();
const cmsBlogResponseRowSchema = z.object({
  id: z.string().min(1).max(200), slug: z.string().min(1).max(160), locale: z.string().min(2).max(16),
  title: z.string().min(1).max(240), excerpt: z.string().max(1_000), body: z.string().max(500_000),
  cover_image_url: z.string().nullable(), author_name: z.string().nullable(),
  tags: z.array(z.string().max(80)).max(50), status: z.enum(["draft", "published", "scheduled"]),
  published_at: z.string().nullable(), scheduled_publish_at: z.string().nullable(),
  preview_token: z.string().nullable(), meta_title: z.string().nullable(),
  meta_description: z.string().nullable(), canonical_url: z.string().nullable(),
  og_image_url: z.string().nullable(), rss_include: z.boolean(), json_ld: z.unknown().nullable(),
  created_at: z.string(), updated_at: z.string(),
}).strict();
export const adminCmsBlogsResponseSchema = z.object({ data: z.array(cmsBlogResponseRowSchema).max(500) }).strict();
export const adminCmsBlogResponseSchema = z.object({ data: cmsBlogResponseRowSchema }).strict();
const cmsExperimentResponseRowSchema = z.object({
  id: z.string().min(1).max(200), organization_id: z.string().nullable(),
  experiment_key: z.string().min(1).max(120), name: z.string().max(240),
  variants: z.array(z.record(z.string().max(80), z.unknown())).max(20), active: z.boolean(),
  updated_at: z.string(), starts_at: z.string().nullable(), ends_at: z.string().nullable(),
  traffic_cap_pct: z.number().min(0).max(100).nullable(), target_page_slug: z.string().nullable(),
  target_component_key: z.string().nullable(), impressions: z.number().int().nonnegative(),
  conversions: z.number().int().nonnegative(),
}).strict();
export const adminCmsExperimentsResponseSchema = z.object({ data: z.array(cmsExperimentResponseRowSchema).max(500) }).strict();
export const adminCmsExperimentResponseSchema = z.object({ data: cmsExperimentResponseRowSchema }).strict();
const cmsFormSettingsResponseRowSchema = z.object({
  id: z.string().min(1).max(200), webhook_url: z.string().nullable(),
  notify_email: z.string().email().nullable(), updated_at: z.string(),
}).strict();
export const adminCmsFormSettingsResponseSchema = z.object({ data: cmsFormSettingsResponseRowSchema.nullable() }).strict();
const cmsFormSubmissionResponseRowSchema = z.object({
  id: z.string().min(1).max(200), form_key: z.string().min(1).max(80),
  payload: z.record(z.string().max(120), z.unknown()), created_at: z.string(),
  ip_hash: z.string().nullable(), read_at: z.string().nullable(),
  assigned_to: z.string().nullable(), spam_score: z.number().min(0).max(1),
}).strict();
export const adminCmsFormSubmissionsResponseSchema = z.object({
  data: z.array(cmsFormSubmissionResponseRowSchema).max(200),
  meta: z.object({ total: z.number().int().nonnegative() }).strict(),
}).strict();
export const adminCmsFormSubmissionResponseSchema = z.object({ data: cmsFormSubmissionResponseRowSchema }).strict();
const cmsMediaRowResponseSchema = z.object({
  id: z.string().min(1).max(200), storage_path: z.string().min(1).max(512),
  public_url: z.string().url().max(2048), alt_text: z.string().max(500).nullable(),
  mime_type: z.string().max(120).nullable(), width: z.number().int().nonnegative().nullable(),
  height: z.number().int().nonnegative().nullable(), created_at: z.string(),
  deleted_at: z.string().nullable(), display_name: z.string().max(160).nullable(),
  byte_size: z.number().int().nonnegative().nullable(), tags: z.array(z.string().max(80)).max(50),
  organization_id: z.string().min(1).max(200),
}).strict();
export const adminCmsMediaResponseSchema = z.object({ data: z.array(cmsMediaRowResponseSchema).max(500) }).strict();
export const adminCmsMediaItemResponseSchema = z.object({ data: cmsMediaRowResponseSchema }).strict();
export const adminCatalogMediaResponseSchema = z.object({
  data: z.array(cmsMediaRowResponseSchema).max(500),
  catalogSourceUnavailable: z.literal(false),
  canWrite: z.boolean(),
}).strict();
export const adminCmsMediaDetailResponseSchema = z.object({ data: z.union([
  cmsMediaRowResponseSchema,
  z.object({ row: cmsMediaRowResponseSchema, refs: z.array(z.object({ source: z.string().max(120), detail: z.string().max(500) }).strict()).max(1_000) }).strict(),
]) }).strict();
export const adminCmsMediaDeleteResponseSchema = z.object({ ok: z.literal(true), storageCleanup: z.enum(["skipped", "removed"]) }).strict();
export const adminCmsComponentDeleteResponseSchema = z.object({
  data: z.object({ archived: z.literal(true) }).strict(),
}).strict();
const adminCmsCategoryContentRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string(),
  collection_id: z.string().nullable(),
  collection_handle: z.string(),
  locale: z.string(),
  intro_html: z.string(),
  banner_url: z.string().nullable(),
  banner_alt: z.string().nullable(),
  blocks: z.array(z.unknown()).max(500),
  updated_at: z.string().datetime(),
}).strict();
export const adminCmsCategoryContentResponseSchema = z.object({ data: adminCmsCategoryContentRowSchema }).strict();
export const adminCmsCategoryContentsResponseSchema = z.object({ data: z.array(adminCmsCategoryContentRowSchema).max(100), limit: z.number().int().positive().max(100) }).strict();
export const adminCmsCategoryGapsResponseSchema = z.object({
  data: z.object({
    locale: z.string(),
    catalog_count: z.number().int().nonnegative(),
    cms_rows_for_locale: z.number().int().nonnegative(),
    missing: z.array(z.object({ id: z.string(), name: z.string(), handle: z.string() }).strict()).max(500),
  }).strict(),
}).strict();
export const adminCmsCategorySyncResponseSchema = z.object({
  data: z.object({ created: z.number().int().nonnegative(), locale: z.string(), totalCategories: z.number().int().nonnegative() }).strict(),
}).strict();
const adminCmsComponentDefinitionRowSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  component_key: z.string(),
  definition: z.record(z.string(), z.unknown()),
  version: z.number().int().positive(),
  status: z.enum(["draft", "published", "archived"]),
  created_by: z.string().nullable(),
  updated_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).strict();
export const adminCmsComponentResponseSchema = z.object({
  data: adminCmsComponentDefinitionRowSchema,
}).strict();
export const adminCmsComponentsResponseSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())).max(500),
  meta: z.object({
    version: z.number().int().positive(),
    contract: z.literal("cms-component-editor-v2"),
    source: z.enum(["organization", "platform-data-defaults"]),
    records: z.array(z.object({ id: z.string(), version: z.number().int().positive(), status: z.enum(["draft", "published", "archived"]) }).strict()).max(500),
  }).strict(),
}).strict();
const catalogMutationClassificationSchema = z.enum(["editorial_only", "merchandising_only", "sellability_affecting", "checkout_affecting"]);
const catalogProviderSyncResponseSchema = z.object({
  state: z.enum(["unavailable", "failed", "synced"]), reason: z.string().max(240).optional(),
  paymentLinkUrl: z.string().url().max(2048).nullable().optional(),
}).strict();
export const adminCatalogProductMutationResponseSchema = z.object({
  productId: z.string().min(1).max(200), mutationClassification: catalogMutationClassificationSchema,
  stripeCatalogSync: catalogProviderSyncResponseSchema,
  storefrontInvalidation: z.string().min(1).max(240),
}).strict();
export const adminCatalogProductDeleteResponseSchema = z.object({
  deleted: z.literal(true), mutationClassification: catalogMutationClassificationSchema,
  storefrontInvalidation: z.string().min(1).max(240),
  stripeCatalogArchive: z.object({ state: z.string().min(1).max(80), reason: z.string().max(240).optional() }).strict(),
}).strict();
export const adminMutationOkResponseSchema = z.object({ ok: z.literal(true) }).strict();
export const adminCmsBlogBulkResponseSchema = z.object({ ok: z.literal(true), deleted: z.number().int().min(0).max(200) }).strict();
export const adminReviewMutationResponseSchema = z.object({
  ok: z.literal(true), review: z.object({ id: z.string().min(1).max(200), status: z.enum(["approved", "rejected", "hidden", "pending"]) }).strict(),
}).strict();
export const storefrontReturnResponseSchema = z.object({
  ok: z.literal(true), order_id: z.string().min(1).max(200),
  items: z.array(z.object({ item_id: z.string().min(1).max(200), quantity: z.number().int().positive().max(1_000_000), reason_id: z.string().max(200).optional(), note: z.string().max(2_000).optional() }).strict()).min(1).max(100),
  auditStatus: z.enum(["recorded", "pending"]).optional(),
}).strict();
export const adminTrackingCapabilityRevokeResponseSchema = z.object({ ok: z.literal(true), revoked: z.literal(true) }).strict();
export const adminTerminalMutationResponseSchema = adminMutationOkResponseSchema;
export const adminPaymentRetryResponseSchema = z.object({
  ok: z.literal(true),
  orderId: z.string().min(1).max(200),
  redirectUrl: z.string().url().max(2048),
}).strict();
const adminReconciliationRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  provider: z.string().min(1).max(64),
  medusaOrderCount: z.number().int().nonnegative(),
  medusaTotalMinor: z.number().finite(),
  providerConfirmedCount: z.number().int().nonnegative(),
  providerConfirmedMinor: z.number().finite(),
  openAttemptCount: z.number().int().nonnegative(),
  problemAttemptCount: z.number().int().nonnegative(),
  discrepancyMinor: z.number().finite(),
  status: z.enum(["matched", "discrepancy", "pending"]),
}).strict();
const adminReconciliationProblemSchema = z.object({
  correlationId: z.string(), provider: z.string(), status: z.string(),
  checkoutState: z.string(), staleReason: z.string().nullable(), updatedAt: z.string(),
}).strict();
const adminReconciliationArtifactSchema = z.object({
  provider: z.string(), status: z.string(), externalId: z.string(), jobId: z.string().nullable(),
  periodStart: z.string().nullable(), periodEnd: z.string().nullable(),
  idempotencyKey: z.string().nullable(), updatedAt: z.string(),
}).strict();
const adminSettlementRecordSchema = z.object({
  provider: z.string(), externalId: z.string(), status: z.string(), amountMinor: z.number().finite().nullable(),
  currency: z.string().nullable(), orderId: z.string().nullable(), mismatchReason: z.string().nullable(),
}).strict();
export const adminReconciliationResponseSchema = z.object({
  period: z.string(), rows: z.array(adminReconciliationRowSchema).max(360),
  totalMedusaMinor: z.number().finite(), totalProviderConfirmedMinor: z.number().finite(),
  totalDiscrepancyMinor: z.number().finite(), paymentAttemptsStaleFinalize: z.number().int().nonnegative(),
  paymentAttemptsNeedsReview: z.number().int().nonnegative(),
  recentProblemAttempts: z.array(adminReconciliationProblemSchema).max(8),
  providerReconciliationArtifacts: z.array(adminReconciliationArtifactSchema).max(25),
  providerSettlementRecords: z.array(adminSettlementRecordSchema).max(500),
}).strict();
export const adminCampaignResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["winback", "birthday", "first_purchase", "upsell", "custom"]),
  segment_id: z.string().nullable(),
  subject: z.string().nullable(),
  body_template: z.string().nullable(),
  channel: z.literal("email"),
  is_active: z.boolean(),
  last_run_at: z.string().datetime().nullable(),
  schedule_cron: z.string().nullable(),
  created_at: z.string().datetime(),
  organization_id: z.string().nullable(),
}).strict();
export const adminCampaignsResponseSchema = z.object({
  data: z.array(adminCampaignResponseSchema).max(500),
}).strict();
export const adminCampaignResponseEnvelopeSchema = z.object({ data: adminCampaignResponseSchema }).strict();
export const adminCampaignPatchSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(), subject: z.string().trim().max(240).nullable().optional(), body_template: z.string().max(100_000).nullable().optional(),
  is_active: z.boolean().optional(), schedule_cron: z.string().trim().max(120).nullable().optional(), segment_id: z.string().uuid().nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: "At least one campaign field is required" });
const adminEmployeeResponseSchema = z.object({
  id: z.string(),
  user_id: z.string().nullable(),
  full_name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  role: z.enum(["admin", "manager", "cashier", "staff"]),
  is_active: z.boolean(),
  hired_at: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  organization_id: z.string().nullable(),
}).strict();
export const adminEmployeesResponseSchema = z.object({
  data: z.array(adminEmployeeResponseSchema).max(500),
}).strict();
export const adminEmployeeResponseEnvelopeSchema = z.object({ data: adminEmployeeResponseSchema }).strict();
export const adminEmployeeDeleteResponseSchema = z.object({ success: z.literal(true) }).strict();
export const adminPinSetResponseSchema = z.object({ success: z.literal(true) }).strict();
export const adminPinVerifyResponseSchema = z.object({ valid: z.boolean() }).strict();
const adminSegmentResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  rule_type: z.enum(["spend_above", "spend_below", "order_count_above", "inactive_days", "product_category", "tier", "manual"]),
  rule_config: z.record(z.string(), z.unknown()),
  auto_refresh: z.boolean(),
  member_count: z.number().int().nonnegative(),
  last_refreshed_at: z.string().nullable(),
  created_at: z.string().datetime(),
  organization_id: z.string().nullable(),
}).strict();
export const adminSegmentsResponseSchema = z.object({ data: z.array(adminSegmentResponseSchema).max(500) }).strict();
export const adminSegmentResponseEnvelopeSchema = z.object({ data: adminSegmentResponseSchema }).strict();
const adminShiftResponseSchema = z.object({
  id: z.string(),
  employee_id: z.string(),
  device_name: z.string(),
  opened_at: z.string().datetime(),
  closed_at: z.string().datetime().nullable(),
  opening_cash: z.number().finite().nonnegative(),
  closing_cash: z.number().finite().nonnegative().nullable(),
  expected_cash: z.number().finite().nonnegative().nullable(),
  notes: z.string().nullable(),
  status: z.enum(["open", "closed"]),
}).strict();
export const adminShiftsResponseSchema = z.object({ data: z.array(adminShiftResponseSchema).max(500) }).strict();
export const adminShiftResponseEnvelopeSchema = z.object({ data: adminShiftResponseSchema }).strict();
export const adminShiftCloseResponseSchema = z.object({
  data: z.object({
    shift: adminShiftResponseSchema,
    reconciliation: z.object({
      id: z.string().min(1).max(200), organization_id: z.string().min(1).max(200), shift_id: z.string().min(1).max(200),
      idempotency_key: z.string().min(1).max(255), opening_cash: z.number().finite().nonnegative(), cash_sales: z.number().finite().nonnegative(),
      cash_refunds: z.number().finite().nonnegative(), payouts: z.number().finite().nonnegative(), expected_cash: z.number().finite(),
      counted_cash: z.number().finite().nonnegative(), variance: z.number().finite(), created_by_email: z.string().email().max(320),
    }).strict(),
  }).strict(),
}).strict();
export const adminSegmentMembersResponseSchema = z.object({
  data: z.array(z.object({ customer_email: z.string().email(), medusa_customer_id: z.string().nullable() }).strict()).max(500),
}).strict();
export const adminSegmentMembersMutationResponseSchema = z.object({ count: z.number().int().nonnegative() }).strict();
export const adminCampaignExecuteResponseSchema = z.union([
  z.object({ queued: z.literal(true), jobId: z.string().min(1) }).strict(),
  z.object({ sent: z.number().int().nonnegative(), replayed: z.literal(true) }).strict(),
]);
export const adminOperatorNotesResponseSchema = z.object({
  notes: z.array(z.object({
    id: z.string(), body: z.string(), author_email: z.string().email().nullable(), created_at: z.string().datetime(),
  }).strict()).max(50),
}).strict();
export const adminOperatorNoteCreateResponseSchema = z.object({ id: z.string() }).strict();
const adminCrmNoteRowSchema = z.object({
  id: z.string().min(1).max(200),
  note_body: z.string().min(1).max(4000),
  author_email: z.string().email().nullable(),
  created_at: z.string().datetime(),
}).strict();
export const adminCrmNotesResponseSchema = z.object({
  data: z.array(adminCrmNoteRowSchema.extend({ is_deleted: z.boolean() }).strict()).max(100),
}).strict();
export const adminCrmNoteCreateResponseSchema = z.object({ data: adminCrmNoteRowSchema }).strict();
const adminCrmActivityRowSchema = z.object({
  id: z.string().min(1).max(200), customer_email: z.string().email(), activity_type: z.enum(["email", "call", "meeting", "note", "task"]),
  subject: z.string().min(1).max(240), body: z.string().max(10_000).nullable(), owner_email: z.string().email().nullable(),
  occurred_at: z.string().datetime(), due_at: z.string().datetime().nullable(), completed_at: z.string().datetime().nullable(),
  metadata: z.record(z.string(), z.unknown()), created_at: z.string().datetime(), updated_at: z.string().datetime(),
}).strict();
const adminCrmDealRowSchema = z.object({
  id: z.string().min(1).max(200), customer_email: z.string().email(), title: z.string().min(1).max(240), stage: z.string().min(1).max(40),
  value: z.number().finite().nonnegative(), probability: z.number().finite().min(0).max(1), owner_email: z.string().email().nullable(),
  expected_close_at: z.string().datetime().nullable(), source: z.string().max(120).nullable(), metadata: z.record(z.string(), z.unknown()),
  created_at: z.string().datetime(), updated_at: z.string().datetime(),
}).strict();
const adminCrmGoalRowSchema = z.object({
  id: z.string().min(1).max(200), owner_email: z.string().email().nullable(), period_start: z.string().date(), period_end: z.string().date(),
  target_value: z.number().finite().nonnegative(), target_deals: z.number().int().nonnegative(), metadata: z.record(z.string(), z.unknown()),
  created_at: z.string().datetime(), updated_at: z.string().datetime(),
}).strict();
const adminCrmOperationRowSchema = z.union([adminCrmActivityRowSchema, adminCrmDealRowSchema, adminCrmGoalRowSchema]);
export const adminCrmOperationsResponseSchema = z.object({
  data: z.object({
    activities: z.array(adminCrmActivityRowSchema).max(200), deals: z.array(adminCrmDealRowSchema).max(200), goals: z.array(adminCrmGoalRowSchema).max(100),
  }).strict(),
}).strict();
export const adminCrmOperationResponseSchema = z.object({ data: adminCrmOperationRowSchema }).strict();
const crmNullableEmail = z.string().email().nullable();
const crmSyncState = z.enum(["pending", "synced", "partial", "failed", "manual_only", "disabled", "stale"]);
const crmSyncMode = z.enum(["automatic", "manual", "disabled"]);
const crmSyncScope = z.enum(["global", "organization", "branch", "customer"]);
const crmConnectionRowSchema = z.object({
  id: z.string().min(1).max(200), provider: z.literal("nango"), provider_config_key: z.string().min(1).max(128), connection_id: z.string().min(1).max(200),
  connection_name: z.string().max(200).nullable(), organization_id: z.string().nullable(), branch_id: z.string().nullable(), staff_user_id: z.string().nullable(), staff_email: crmNullableEmail,
  sync_scope: crmSyncScope, active: z.boolean(), tags: z.record(z.string(), z.unknown()), metadata: z.record(z.string(), z.unknown()),
  last_authorized_at: z.string().datetime().nullable(), last_synced_at: z.string().datetime().nullable(), last_error: z.string().max(4_000).nullable(),
  created_at: z.string().datetime(), updated_at: z.string().datetime(),
}).strict();
const crmMappingRowSchema = z.object({
  id: z.string().min(1).max(200), organization_id: z.string().nullable(), customer_email: z.string().email(), medusa_customer_id: z.string().nullable(), provider: z.literal("nango"),
  connection_id: z.string().nullable(), external_contact_id: z.string().nullable(), external_account_id: z.string().nullable(), sync_state: crmSyncState, sync_mode: crmSyncMode,
  capabilities: z.record(z.string(), z.unknown()), metadata: z.record(z.string(), z.unknown()), last_error_code: z.string().max(200).nullable(), last_error: z.string().max(4_000).nullable(), last_failed_step: z.string().max(200).nullable(),
  last_synced_at: z.string().datetime().nullable(), last_webhook_event_id: z.string().nullable(), last_webhook_status: z.string().max(100).nullable(), correlation_id: z.string().nullable(), idempotency_key: z.string().nullable(),
  created_by_email: crmNullableEmail, updated_by_email: crmNullableEmail, created_at: z.string().datetime(), updated_at: z.string().datetime(),
}).strict();
const crmRecordRowSchema = z.object({
  id: z.string().min(1).max(200), provider: z.literal("nango"), provider_config_key: z.string().min(1).max(128), connection_id: z.string().min(1).max(200),
  local_entity_type: z.enum(["contact", "deal"]), local_record_id: z.string().min(1).max(200), local_record_label: z.string().max(320).nullable(), external_entity_type: z.enum(["contact", "deal"]).nullable(), external_record_id: z.string().nullable(), external_account_id: z.string().nullable(),
  sync_state: crmSyncState, sync_mode: crmSyncMode, sync_scope: crmSyncScope, metadata: z.record(z.string(), z.unknown()), tags: z.record(z.string(), z.unknown()),
  last_error_code: z.string().max(200).nullable(), last_error: z.string().max(4_000).nullable(), last_failed_step: z.string().max(200).nullable(), last_synced_at: z.string().datetime().nullable(), last_synced_by_email: crmNullableEmail,
  last_direction: z.enum(["to_crm", "from_crm", "bidirectional"]).nullable(), correlation_id: z.string().nullable(), created_by_email: crmNullableEmail, updated_by_email: crmNullableEmail, created_at: z.string().datetime(), updated_at: z.string().datetime(),
}).strict();
const crmSupportedAppSchema = z.object({ provider_config_key: z.string().min(1).max(128), label: z.string().min(1).max(200), category: z.string().min(1).max(80) }).strict();
export const adminCrmBridgeResponseSchema = z.object({ data: z.object({
  connections: z.array(crmConnectionRowSchema).max(25), mappings: z.array(crmMappingRowSchema).max(25), records: z.array(crmRecordRowSchema).max(25),
  supportedApps: z.array(crmSupportedAppSchema).max(100), summary: z.object({ connections: z.number().int().nonnegative(), mappings: z.number().int().nonnegative(), records: z.number().int().nonnegative() }).strict(),
}).strict() }).strict();
export const adminCrmBridgeMutationResponseSchema = z.object({ data: z.union([crmConnectionRowSchema, crmMappingRowSchema, crmRecordRowSchema]) }).strict();
const nangoConnectionStatusSchema = z.object({
  provider_config_key: z.string().min(1).max(100), nango_connection_id: z.string().min(1).max(200), provider: z.string().max(100).nullable().optional(),
  active: z.boolean(), status: z.enum(["connected", "needs_attention"]), error: z.string().max(4_000).nullable().optional(), updated_at: z.string().datetime().optional(),
}).strict();
export const adminNangoConnectionsResponseSchema = z.object({
  data: z.array(nangoConnectionStatusSchema).max(100), integrations: z.array(z.object({ id: z.string().min(1).max(100), label: z.string().min(1).max(200) }).strict()).max(100),
}).strict();
export const adminNangoMutationResponseSchema = z.union([
  z.object({ data: z.object({ session_token: z.string().min(1).max(10_000) }).strict() }).strict(),
  z.object({ data: z.object({ provider_config_key: z.string().min(1).max(100), nango_connection_id: z.string().min(1).max(200), active: z.literal(true), status: z.literal("connected") }).strict() }).strict(),
  z.object({ data: z.object({ disconnected: z.literal(true) }).strict() }).strict(),
]);
const pancakeResourceSchema = z.enum(["shops", "feature-mappings", "orders", "customers", "products", "warehouses", "inventory_histories", "order_source", "order_tags", "e_invoices", "employees", "analytics_sale"]);
export const adminPancakeIntegrationResponseSchema = z.object({
  configured: z.boolean(), provider: z.literal("pancake_pos"), resource: pancakeResourceSchema, shopId: z.string().min(1).max(200).optional(),
  data: z.unknown(), message: z.string().max(500).optional(),
}).strict();
const boundedDeliveryRowSchema = z.record(z.string().max(128), z.unknown()).superRefine((value, ctx) => {
  if (Object.keys(value).length > 100) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Delivery row has too many fields" });
});
export const adminDeliveryOperationsResponseSchema = z.object({
  data: z.object({ couriers: z.array(boundedDeliveryRowSchema).max(200), openExceptions: z.array(boundedDeliveryRowSchema).max(200) }).strict(),
}).strict();
export const adminDeliveryShipmentResponseSchema = z.object({
  data: z.object({ shipments: z.array(boundedDeliveryRowSchema).max(100), events: z.array(boundedDeliveryRowSchema).max(100) }).strict(),
}).strict();
const courierDefinitionResponseSchema = z.object({
  slug: z.string().trim().min(1).max(100), label: z.string().trim().min(1).max(200), region: z.string().trim().length(2),
  aftershipSlug: z.string().trim().min(1).max(100).optional(), supportsLabels: z.boolean(),
}).strict();
export const integrationsCouriersResponseSchema = z.object({ couriers: z.array(courierDefinitionResponseSchema).max(100) }).strict();
const inventoryTransferLineResponseSchema = z.union([
  z.object({ id: z.string().min(1).max(200), transfer_id: z.string().min(1).max(200), product_id: z.string().min(1).max(200), variant_id: z.string().min(1).max(200), quantity: z.number().int().positive(), created_at: z.string().datetime() }).strict(),
  z.object({ productId: z.string().min(1).max(200), variantId: z.string().min(1).max(200), quantity: z.number().int().positive() }).strict(),
]);
const inventoryTransferRowSchema = z.object({
  id: z.string().min(1).max(200), organization_id: z.string().min(1).max(200), source_location_id: z.string().min(1).max(200), destination_location_id: z.string().min(1).max(200),
  status: z.enum(["draft", "approved", "in_transit", "processing", "completed", "failed", "cancelled"]), revision: z.number().int().positive(), idempotency_key: z.string().min(1).max(255),
  failure_code: z.string().max(200).nullable(), failure_message: z.string().max(4_000).nullable(), created_by_email: z.string().email(), created_at: z.string().datetime(), updated_at: z.string().datetime(), completed_at: z.string().datetime().nullable(),
  inventory_transfer_lines: z.array(inventoryTransferLineResponseSchema).max(100).optional(),
}).strict();
export const adminInventoryTransfersResponseSchema = z.object({ data: z.array(inventoryTransferRowSchema).max(200), organizationId: z.string().min(1).max(200) }).strict();
export const adminInventoryTransferResponseSchema = z.object({ data: inventoryTransferRowSchema, organizationId: z.string().min(1).max(200).optional() }).strict();
const adminInvoiceRowSchema = z.object({
  id: z.string().uuid(), reference_number: z.string().min(1).max(80), status: z.enum(["draft", "sending", "sent", "failed", "retryable", "voided", "refunded"]), currency: z.literal("PHP"),
  total: z.number().finite().nonnegative(), recipient_email: z.string().email().nullable(), sent_at: z.string().datetime().nullable(), created_by: z.string().min(1).max(320), created_at: z.string().datetime(), updated_at: z.string().datetime(),
  document_kind: z.enum(["admin_artifact", "commercial_invoice", "fiscal_invoice"]), fiscal_status: z.enum(["non_fiscal", "draft", "issued", "voided"]), fiscal_number: z.string().max(80).nullable(), medusa_order_id: z.string().max(255).nullable(), refund_id: z.string().max(255).nullable(),
}).strict();
export const adminInvoicesResponseSchema = z.object({ data: z.array(adminInvoiceRowSchema).max(50) }).strict();
export const adminInvoiceResponseSchema = z.object({ data: adminInvoiceRowSchema }).strict();
const adminReceiptRowSchema = z.object({
  id: z.string().min(1).max(200), order_id: z.string().min(1).max(200), customer_email: z.string().email().nullable(),
  receipt_html: z.string().max(1_000_000), sent_at: z.string().datetime().nullable(), created_at: z.string().datetime(),
}).strict();
export const adminReceiptResponseSchema = z.object({ data: adminReceiptRowSchema }).strict();
const posFiscalProfileSchema = z.object({ id: z.string().min(1).max(200), organization_id: z.string().min(1).max(200), jurisdiction: z.string().min(2).max(16), registration_number: z.string().min(1).max(64), invoice_prefix: z.string().min(1).max(16), enabled: z.boolean(), created_at: z.string().datetime() }).strict();
const posCertificationSchema = z.object({ id: z.string().min(1).max(200), organization_id: z.string().min(1).max(200), provider: z.string().min(1).max(120), model: z.string().min(1).max(120), firmware: z.string().min(1).max(80), certification_id: z.string().min(1).max(120), expires_at: z.string().datetime().nullable(), active: z.boolean(), created_at: z.string().datetime() }).strict();
const posPaymentTerminalSchema = z.object({ id: z.string().min(1).max(200), organization_id: z.string().min(1).max(200), device_id: z.string().uuid().nullable(), provider: z.string().min(1).max(120), model: z.string().min(1).max(120), serial_number: z.string().min(1).max(120), status: z.enum(["pending", "certified", "degraded", "disabled"]), certification_id: z.string().max(120).nullable(), last_health_at: z.string().datetime().nullable(), metadata: z.record(z.string(), z.unknown()), provider_terminal_external_id: z.string().max(255).nullable(), payment_provider_artifact_id: z.string().uuid().nullable(), created_at: z.string().datetime() }).strict();
export const adminPosEnterpriseResponseSchema = z.object({ data: z.object({ fiscal: z.array(posFiscalProfileSchema).max(100), certifications: z.array(posCertificationSchema).max(100), paymentTerminals: z.array(posPaymentTerminalSchema).max(100) }).strict() }).strict();
export const adminPosEnterpriseMutationResponseSchema = z.object({ data: z.union([posFiscalProfileSchema, posCertificationSchema, posPaymentTerminalSchema]) }).strict();
const adminShiftReconciliationShiftSchema = z.object({
  id: z.string().min(1).max(200), employee_id: z.string().min(1).max(200), device_name: z.string().min(1).max(200),
  opened_at: z.string().datetime(), closed_at: z.string().datetime().nullable(), opening_cash: z.number().finite().nonnegative(),
  closing_cash: z.number().finite().nonnegative().nullable(), expected_cash: z.number().finite().nullable(), notes: z.string().max(1_000).nullable(),
  status: z.enum(["open", "closed"]),
}).strict();
const adminShiftReconciliationVoidSchema = z.object({
  id: z.string().min(1).max(200), shift_id: z.string().max(200).nullable(), employee_id: z.string().min(1).max(200), approved_by: z.string().max(200).nullable(),
  order_id: z.string().max(200).nullable(), line_item_id: z.string().max(200).nullable(), action: z.enum(["void_item", "void_order", "refund", "discount_override"]),
  amount: z.number().finite().nonnegative().nullable(), reason: z.string().max(1_000).nullable(), pin_verified: z.boolean(), created_at: z.string().datetime(),
}).strict();
export const adminShiftReconciliationResponseSchema = z.object({
  shift: adminShiftReconciliationShiftSchema,
  voids: z.array(adminShiftReconciliationVoidSchema).max(200), voidCount: z.number().int().nonnegative().max(200),
  voidAmountMinor: z.number().finite().nonnegative(), medusaOrdersForShift: z.number().int().nonnegative().max(10_000),
  medusaSalesTotalMinor: z.number().finite().nonnegative(), openingCash: z.number().finite().nonnegative(), closingCash: z.number().finite().nonnegative().nullable(),
  expectedCash: z.number().finite().nullable(), cashVariance: z.number().finite().nullable(),
}).strict();
const adminReviewEntrySchema = z.object({
  id: z.string(),
  product_slug: z.string(),
  medusa_product_id: z.string().nullable(),
  rating: z.number().int().min(1).max(5),
  author_name: z.string(),
  body: z.string(),
  status: z.enum(["pending", "approved", "rejected", "hidden"]),
  created_at: z.string().datetime(),
  customer_email: z.string().email().nullable(),
  medusa_customer_id: z.string().nullable(),
  verified_medusa_order_id: z.string().nullable(),
  moderated_by_staff_email: z.string().email().nullable(),
  is_verified_buyer: z.boolean(),
  risk_score: z.number().int().nonnegative(),
  shadow_banned: z.boolean(),
  moderated_at: z.string().datetime().nullable(),
  moderation_note: z.string().nullable(),
  open_report_count: z.number().int().nonnegative(),
}).strict();
export const adminReviewsResponseSchema = z.object({ reviews: z.array(adminReviewEntrySchema).max(200) }).strict();
const adminVoidEntrySchema = z.object({
  id: z.string(), shift_id: z.string().nullable(), employee_id: z.string(), approved_by: z.string().nullable(),
  order_id: z.string().nullable(), line_item_id: z.string().nullable(),
  action: z.enum(["void_item", "void_order", "refund", "discount_override"]),
  amount: z.number().finite().nonnegative().nullable(), reason: z.string().nullable(),
  pin_verified: z.boolean(), created_at: z.string().datetime(),
}).strict();
export const adminVoidRequestSchema = z.object({
  shift_id: z.string().uuid().optional(), employee_id: z.string().uuid(), approved_by: z.string().uuid().optional(),
  order_id: z.string().trim().max(120).optional(), line_item_id: z.string().trim().max(120).optional(),
  action: z.enum(["void_item", "void_order", "refund", "discount_override"]), amount: z.number().finite().nonnegative().max(1_000_000).optional(),
  reason: z.string().trim().min(1).max(500).optional(), pin_verified: z.boolean().optional(),
}).strict();
export const adminVoidsResponseSchema = z.object({ data: z.array(adminVoidEntrySchema).max(100) }).strict();
export const adminVoidResponseEnvelopeSchema = z.object({ data: adminVoidEntrySchema }).strict();

export const adminRequestContracts = {
  "post /auth/e2e": e2eAuthRequestSchema,
  "post /admin/campaigns": adminCampaignCreateSchema,
  "patch /admin/campaigns/{id}": adminCampaignPatchSchema,
  "post /admin/receipts": adminReceiptCreateSchema,
  "post /admin/inventory/adjust": adminInventoryAdjustmentSchema,
  "put /admin/employees/{id}/pin": adminEmployeePinSchema,
  "post /admin/employees/{id}/pin": adminEmployeePinSchema,
  "patch /admin/orders/{orderId}/status": adminOrderStatusSchema,
  "post /admin/terminal-open-drawer": adminDrawerRequestSchema,
  "post /admin/tracking-capabilities/revoke": adminTrackingCapabilityRevokeSchema,
  "post /admin/pin-approval": adminPinApprovalSchema,
  "post /admin/shifts/{id}/close": adminShiftCloseSchema,
  "post /admin/catalog/categories": adminCatalogCategoryCreateSchema,
  "post /admin/orders/bulk-fulfill": adminBulkFulfillmentSchema,
  "post /admin/chat-orders/{id}/status": adminChatOrderStatusSchema,
  "post /admin/catalog/products": catalogProductRequestSchema,
  "patch /admin/catalog/products/{id}": catalogProductRequestSchema,
  "post /admin/devices": adminDeviceSchema,
  "patch /admin/devices/{id}": adminDevicePatchSchema,
  "post /admin/workflow/transition": adminWorkflowTransitionSchema,
  "post /admin/voids": adminVoidRequestSchema,
  "post /admin/inventory/cycle-counts": adminCycleCountCreateSchema,
  "post /admin/inventory/purchase-orders": adminPurchaseOrderCreateSchema,
  "patch /account/marketing-preferences": accountMarketingPreferencesPatchSchema,
  "patch /account/order-preferences": accountOrderPreferencesPatchSchema,
  "post /cart/reconcile": cartReconcileRequestSchema,
  "post /wishlist": wishlistRequestSchema,
  "post /wishlist/sync": wishlistSyncRequestSchema,
  "patch /account/profile": storefrontCustomerProfilePatchSchema,
  "post /admin/terminal-print": terminalPrintBodySchema,
  "post /admin/terminal-print-label": terminalPrintLabelBodySchema,
  "post /admin/loyalty": adminLoyaltyCreateSchema,
  "post /admin/loyalty/points": adminLoyaltyPointsSchema,
  "post /admin/loyalty/rewards": adminLoyaltyRewardCreateSchema,
  "post /admin/segments": adminSegmentCreateSchema,
  "post /admin/segments/{id}/members": adminSegmentMembersSchema,
  "post /admin/employees": adminEmployeeCreateSchema,
  "patch /admin/employees/{id}": adminEmployeePatchSchema,
  "post /admin/operator-notes": adminOperatorNoteCreateSchema,
  "post /admin/offline-queue": adminOfflineQueueCreateSchema,
  "patch /admin/offline-queue": adminOfflineQueuePatchSchema,
  "post /cart/merge": cartMergePostBodySchema,
  "post /orders/return": storefrontReturnRequestBodySchema,
  "post /checkout/apply-promo": storefrontApplyPromoSchema,
  "delete /checkout/apply-promo": storefrontApplyPromoSchema,
  "post /tracking-link": storefrontTrackingLinkSchema,
  "post /pos/commerce/lookup": adminPosCommerceLookupSchema,
  "post /admin/cms/announcement": cmsAnnouncementSchema,
  "post /admin/cms/block-presets": cmsPresetSchema,
  "post /admin/cms/blog": cmsBlogSchema,
  "put /admin/cms/blog/{id}": cmsBlogSchema,
  "post /admin/cms/blog/bulk": cmsBlogBulkSchema,
  "post /admin/cms/components": cmsComponentWriteSchema,
  "patch /admin/cms/components/{id}": cmsComponentWriteSchema,
  "post /admin/cms/components/{id}": cmsComponentActionSchema,
  "post /admin/cms/experiments": cmsExperimentSchema,
  "put /admin/cms/experiments/{id}": cmsExperimentSchema,
  "put /admin/cms/forms/settings": cmsFormSettingsSchema,
  "patch /admin/cms/forms/submissions/{id}": cmsFormSubmissionSchema,
  "put /admin/cms/navigation": cmsNavigationSchema,
  "post /admin/cms/pages": cmsPageSchema,
  "put /admin/cms/pages/{id}": cmsPageSchema,
  "post /admin/cms/redirects": cmsRedirectSchema,
  "put /admin/cms/redirects/{id}": cmsRedirectSchema,
  "patch /admin/cms/redirects/bulk": cmsRedirectBulkSchema,
  "post /account/privacy/erasure": storefrontPrivacyErasureConfirmationSchema,
  "post /cms/announcement/track": cmsAnnouncementTrackSchema,
  "post /cms/experiments/impression": cmsExperimentImpressionSchema,
  "post /forms/{formKey}": cmsFormSubmissionPayloadSchema,
  "post /reviews": storefrontReviewRouteSchema,
  "post /tracking-link/resolve": trackingLinkResolveSchema,
  "put /admin/cms/announcement": cmsAnnouncementSchema,
  "post /checkout/commerce-telemetry": checkoutCommerceTelemetrySchema,
  "post /checkout/verify-stock": checkoutVerifyStockSchema,
  "post /internal/reconcile-payment-attempt": internalReconcilePaymentAttemptSchema,
  "post /payments/checkout-intents": paymentCheckoutIntentSchema,
  "patch /admin/profile": adminProfilePatchSchema,
  "put /admin/runtime-settings": adminRuntimeSettingsSchema,
  "put /admin/storefront-public-metadata": adminStorefrontPublicMetadataSchema,
  "put /admin/storefront-home": adminStorefrontHomeSchema,
  "post /admin/crm/bridge": adminCrmBridgeSchema,
  "post /admin/delivery-logistics/shipments": adminDeliveryShipmentSchema,
  "post /admin/invoices": adminInvoiceCreateSchema,
  "post /admin/invoices/{id}/lifecycle": adminInvoiceLifecycleSchema,
  "post /integrations/chat-orders/intake": adminChatOrderIntakeSchema,
  "post /internal/invalidate-commerce-state": internalCommerceInvalidationSchema,
  "post /checkout/upload-payment-receipt": adminPaymentReceiptUploadSchema,
} as const;

export const adminResponseContracts = {
  "post /auth/e2e": e2eAuthResponseSchema,
  "delete /auth/e2e": e2eAuthResponseSchema,
  "patch /admin/profile": adminProfileResponseSchema,
  "get /admin/storefront-public-metadata": adminStorefrontPublicMetadataResponseSchema,
  "put /admin/storefront-public-metadata": adminStorefrontPublicMetadataResponseSchema,
  "get /admin/runtime-settings": adminRuntimeSettingsResponseSchema,
  "put /admin/runtime-settings": adminRuntimeSettingsResponseSchema,
  "get /admin/feature-mappings": adminFeatureMappingsResponseSchema,
  "get /admin/integration-health": adminIntegrationHealthResponseSchema,
  "get /admin/payment-health": adminPaymentHealthResponseSchema,
  "get /admin/payments/capabilities": adminPaymentCapabilitiesResponseSchema,
  "get /admin/tasks/today": adminTasksTodayResponseSchema,
  "get /admin/roles": adminRolesResponseSchema,
  "get /admin/analytics/clv": adminAnalyticsClvResponseSchema,
  "get /admin/analytics/retention": adminAnalyticsRetentionResponseSchema,
  "get /admin/analytics/sales-trends": adminAnalyticsSalesTrendsResponseSchema,
  "get /auth/session": authSessionResponseSchema,
  "get /health": healthResponseSchema,
  "get /health/sop": healthSopResponseSchema,
  "get /shop/search-suggest": searchSuggestionsResponseSchema,
  "get /catalog/product-default-variant": catalogDefaultVariantResponseSchema,
  "get /cart/resume": cartResumeResponseSchema,
  "get /checkout/loyalty-balance": loyaltyBalanceResponseSchema,
  "get /account/loyalty": customerLoyaltyResponseSchema,
  "get /account/marketing-preferences": accountMarketingPreferencesResponseSchema,
  "patch /account/marketing-preferences": accountMarketingPreferencesResponseSchema,
  "get /account/order-preferences": accountOrderPreferencesResponseSchema,
  "patch /account/order-preferences": accountOrderPreferencesResponseSchema,
  "get /wishlist": wishlistResponseSchema,
  "post /wishlist": wishlistCreateResponseSchema,
  "delete /wishlist": wishlistDeleteResponseSchema,
  "get /cron/back-in-stock": cronBackInStockResponseSchema,
  "get /cron/campaigns": cronCampaignsResponseSchema,
  "get /cron/inventory-reservations": cronInventoryReservationsResponseSchema,
  "get /cron/payment-reconciliation": cronPaymentReconciliationResponseSchema,
  "get /payments/checkout-intents/recover": checkoutIntentRecoveryResponseSchema,
  "get /payments/checkout-intents/{correlationId}": checkoutIntentResponseSchema,
  "patch /account/profile": accountProfilePatchResponseSchema,
  "post /back-in-stock": backInStockResponseSchema,
  "post /checkout/cod-cart-payload": checkoutCodCartPayloadResponseSchema,
  "post /checkout/verify-stock": checkoutVerifyStockResponseSchema,
  "post /checkout/apply-promo": checkoutApplyPromoResponseSchema,
  "delete /checkout/apply-promo": checkoutApplyPromoResponseSchema,
  "post /checkout/complete": legacyRouteRetiredResponseSchema,
  "post /cms/announcement/track": simpleOkResponseSchema,
  "post /cms/experiments/impression": simpleOkResponseSchema,
  "post /newsletter/unsubscribe": simpleOkResponseSchema,
  "post /newsletter": simpleOkResponseSchema,
  "get /newsletter/confirm": newsletterConfirmResponseSchema,
  "delete /cart/line": cartLineMutationResponseSchema,
  "put /cart/line": cartLineMutationResponseSchema,
  "post /cart/bind": cartBindResponseSchema,
  "post /cart/merge": cartMergeResponseSchema,
  "post /cart/reconcile": cartReconcileResponseSchema,
  "post /cart/abandonment": simpleOkResponseSchema,
  "post /account/orders/{orderId}/cancel": accountOrderCancelResponseSchema,
  "post /checkout/start": checkoutStartResponseSchema,
  "post /checkout/cod-place-order": codPlaceOrderResponseSchema,
  "post /tracking-link": trackingLinkResponseSchema,
  "post /reviews/helpful/{id}": reviewHelpfulResponseSchema,
  "post /account/privacy/erasure": accountPrivacyErasureResponseSchema,
  "post /cart/attach-customer": cartAttachCustomerResponseSchema,
  "post /checkout/commerce-telemetry": commerceTelemetryResponseSchema,
  "post /internal/invalidate-commerce-state": commerceInvalidationResponseSchema,
  "get /account/privacy/export": accountPrivacyExportResponseSchema,
  "post /checkout/upload-payment-receipt": paymentReceiptUploadResponseSchema,
  "post /forms/{formKey}": cmsFormSubmissionResponseSchema,
  "get /cron/finalize-payment-attempts": cronFinalizePaymentAttemptsResponseSchema,
  "post /pos/commerce/draft-order": posCommerceDraftOrderResponseSchema,
  "post /pos/commerce/commit-sale": posCommerceCommitSaleResponseSchema,
  "post /checkout/paypal/confirm": paypalConfirmationResponseSchema,
  "post /payments/checkout-intents": checkoutIntentRegistrationResponseSchema,
  "post /payments/checkout-intents/{correlationId}/finalize": checkoutIntentFinalizeResponseSchema,
  "get /cms/preview": cmsPreviewResponseSchema,
  "get /internal/dev-diagnostics": devDiagnosticsResponseSchema,
  "post /internal/reconcile-payment-attempt": internalReconcilePaymentAttemptResponseSchema,
  "post /webhooks/nango": nangoWebhookResponseSchema,
  "get /feature-mappings": publicFeatureMappingsResponseSchema,
  "get /checkout/available-payment-methods": checkoutAvailablePaymentMethodsResponseSchema,
  "get /integrations/couriers": integrationsCouriersResponseSchema,
  "get /pos/commerce/quick-products": posCommerceQuickProductsResponseSchema,
  "get /pos/commerce/search": posCommerceSearchResponseSchema,
  "get /pos/commerce/suggestions": posCommerceSuggestionsResponseSchema,
  "get /reviews/csrf": reviewCsrfResponseSchema,
  "get /reviews": storefrontReviewsResponseSchema,
  "post /reviews": storefrontReviewCreateResponseSchema,
  "get /shop/product": shopProductResponseSchema,
  "get /cart/bind-token": cartBindTokenResponseSchema,
  "get /admin/cms/pages/{id}/mutations": cmsPageMutationsResponseSchema,
  "get /admin/catalog/categories": adminCatalogCategoriesResponseSchema,
  "post /admin/catalog/categories": adminCatalogCategoryCreateResponseSchema,
  "get /admin/channels/events": adminChannelEventsResponseSchema,
  "post /admin/channels/events/{id}/process": adminChannelEventProcessResponseSchema,
  "get /admin/catalog/products/suggestions": adminCatalogProductSuggestionsResponseSchema,
  "get /admin/chat-orders/variant-suggestions": adminChatOrderVariantSuggestionsResponseSchema,
  "get /admin/devices": adminDevicesResponseSchema,
  "post /admin/devices": adminDeviceResponseEnvelopeSchema,
  "patch /admin/devices/{id}": adminDeviceResponseEnvelopeSchema,
  "get /admin/pos/feature-mappings": adminPosFeatureMappingsResponseSchema,
  "get /admin/commerce/products/search": adminCommerceProductSearchResponseSchema,
  "get /admin/commerce/products/lookup": adminCommerceProductLookupResponseSchema,
  "get /admin/commerce-recovery-metrics": adminCommerceRecoveryMetricsResponseSchema,
  "get /admin/loyalty": adminLoyaltyAccountsResponseSchema,
  "post /admin/loyalty": adminLoyaltyAccountResponseEnvelopeSchema,
  "get /admin/loyalty/lookup": adminLoyaltyAccountResponseEnvelopeSchema,
  "get /admin/loyalty/rewards": adminLoyaltyRewardsResponseSchema,
  "post /admin/loyalty/rewards": adminLoyaltyRewardResponseEnvelopeSchema,
  "get /admin/offline-queue": adminOfflineQueueResponseSchema,
  "post /admin/offline-queue": adminOfflineQueueItemResponseSchema,
  "patch /admin/offline-queue": adminOfflineQueueMutationResponseSchema,
  "get /account/profile/status": accountProfileStatusResponseSchema,
  "get /admin/inventory": adminInventoryResponseSchema,
  "post /admin/inventory/adjust": adminInventoryAdjustmentResponseSchema,
  "get /admin/inventory/stream": adminInventoryStreamResponseSchema,
  "get /admin/inventory/ledger": adminInventoryLedgerResponseSchema,
  "get /admin/inventory/cycle-counts": adminInventoryCycleCountsResponseSchema,
  "get /admin/inventory/cycle-counts/{id}": adminInventoryCycleCountResponseSchema,
  "get /admin/inventory/purchase-orders": adminInventoryPurchaseOrdersResponseSchema,
  "get /admin/inventory/purchase-orders/{id}": adminInventoryPurchaseOrderResponseSchema,
  "post /admin/inventory/cycle-counts": adminInventoryCycleCountResponseSchema,
  "post /admin/inventory/cycle-counts/{id}": adminInventoryCycleCountResponseSchema,
  "post /admin/inventory/purchase-orders": adminInventoryPurchaseOrderResponseSchema,
  "post /admin/inventory/purchase-orders/{id}": adminInventoryPurchaseOrderResponseSchema,
  "get /admin/inventory/reservations": adminInventoryReservationsResponseSchema,
  "post /admin/inventory/reservations": adminInventoryReservationResponseSchema,
  "post /admin/inventory/reservations/{id}": adminInventoryReservationResponseSchema,
  "post /wishlist/sync": wishlistSyncResponseSchema,
  "get /admin/payments": adminPaymentsResponseSchema,
  "get /admin/audit-logs": adminAuditLogsResponseSchema,
  "get /admin/workflow/entities": adminWorkflowEntitiesResponseSchema,
  "post /admin/pin-approval": adminPinApprovalResponseSchema,
  "post /admin/shifts/{id}/close": adminShiftCloseResponseSchema,
  "post /admin/workflow/transition": adminWorkflowTransitionResponseSchema,
  "get /admin/cost-visibility": adminCostVisibilityResponseSchema,
  "get /admin/reconciliation": adminReconciliationResponseSchema,
  "get /admin/cms/announcement": adminCmsAnnouncementResponseSchema,
  "put /admin/cms/announcement": adminCmsAnnouncementResponseSchema,
  "delete /admin/cms/announcement": adminMutationOkResponseSchema,
  "get /admin/cms/navigation": adminCmsNavigationResponseSchema,
  "put /admin/cms/navigation": adminCmsNavigationResponseSchema,
  "get /admin/cms/block-presets": adminCmsBlockPresetsResponseSchema,
  "post /admin/cms/block-presets": adminCmsBlockPresetResponseSchema,
  "delete /admin/cms/block-presets/{id}": adminMutationOkResponseSchema,
  "get /admin/cms/redirects": adminCmsRedirectsResponseSchema,
  "post /admin/cms/redirects": adminCmsRedirectResponseSchema,
  "put /admin/cms/redirects/{id}": adminCmsRedirectResponseSchema,
  "delete /admin/cms/redirects/{id}": adminMutationOkResponseSchema,
  "patch /admin/cms/redirects/bulk": adminCmsRedirectBulkResponseSchema,
  "post /admin/cms/redirects/import": adminCmsRedirectImportResponseSchema,
  "patch /admin/orders/{orderId}/status": adminOrderStatusResponseSchema,
  "post /admin/orders/{orderId}/refund": adminOrderRefundResponseSchema,
  "post /admin/orders/bulk-fulfill": adminBulkFulfillmentResponseSchema,
  "get /admin/cms/redirects/resolve": adminCmsRedirectResolveResponseSchema,
  "get /admin/cms/pages": adminCmsPagesResponseSchema,
  "post /admin/cms/pages": adminCmsPageResponseSchema,
  "get /admin/cms/pages/{id}": adminCmsPageResponseSchema,
  "put /admin/cms/pages/{id}": adminCmsPageResponseSchema,
  "get /admin/cms/blog": adminCmsBlogsResponseSchema,
  "post /admin/cms/blog": adminCmsBlogResponseSchema,
  "get /admin/cms/blog/{id}": adminCmsBlogResponseSchema,
  "put /admin/cms/blog/{id}": adminCmsBlogResponseSchema,
  "delete /admin/cms/pages/{id}": adminMutationOkResponseSchema,
  "delete /admin/cms/blog/{id}": adminMutationOkResponseSchema,
  "get /admin/cms/experiments": adminCmsExperimentsResponseSchema,
  "post /admin/cms/experiments": adminCmsExperimentResponseSchema,
  "put /admin/cms/experiments/{id}": adminCmsExperimentResponseSchema,
  "get /admin/cms/forms/settings": adminCmsFormSettingsResponseSchema,
  "put /admin/cms/forms/settings": adminCmsFormSettingsResponseSchema,
  "get /admin/cms/forms/submissions": adminCmsFormSubmissionsResponseSchema,
  "patch /admin/cms/forms/submissions/{id}": adminCmsFormSubmissionResponseSchema,
  "get /admin/cms/media": adminCmsMediaResponseSchema,
  "post /admin/cms/media": adminCmsMediaItemResponseSchema,
  "get /admin/cms/media/{id}": adminCmsMediaDetailResponseSchema,
  "patch /admin/cms/media/{id}": adminCmsMediaItemResponseSchema,
  "delete /admin/cms/media/{id}": adminCmsMediaDeleteResponseSchema,
  "get /admin/catalog/media": adminCatalogMediaResponseSchema,
  "post /admin/catalog/media": adminCmsMediaItemResponseSchema,
  "delete /admin/cms/components/{id}": adminCmsComponentDeleteResponseSchema,
  "get /admin/cms/components": adminCmsComponentsResponseSchema,
  "get /admin/cms/components/{id}": adminCmsComponentResponseSchema,
  "patch /admin/cms/components/{id}": adminCmsComponentResponseSchema,
  "post /admin/cms/components": adminCmsComponentResponseSchema,
  "post /admin/cms/components/{id}": adminCmsComponentResponseSchema,
  "get /admin/cms/category-content": adminCmsCategoryContentsResponseSchema,
  "post /admin/cms/category-content": adminCmsCategoryContentResponseSchema,
  "get /admin/cms/category-content/catalog-gaps": adminCmsCategoryGapsResponseSchema,
  "post /admin/cms/category-content/sync-from-catalog": adminCmsCategorySyncResponseSchema,
  "get /admin/cms/category-content/catalog-categories": adminCatalogCategoriesResponseSchema,
  "post /admin/catalog/products": adminCatalogProductMutationResponseSchema,
  "patch /admin/catalog/products/{id}": adminCatalogProductMutationResponseSchema,
  "delete /admin/catalog/products/{id}": adminCatalogProductDeleteResponseSchema,
  "get /admin/storefront-home": adminStorefrontHomeResponseSchema,
  "put /admin/storefront-home": adminStorefrontHomeResponseSchema,
  "get /admin/campaigns": adminCampaignsResponseSchema,
  "get /admin/campaigns/{id}": adminCampaignResponseEnvelopeSchema,
  "post /admin/campaigns": adminCampaignResponseEnvelopeSchema,
  "patch /admin/campaigns/{id}": adminCampaignResponseEnvelopeSchema,
  "get /admin/employees": adminEmployeesResponseSchema,
  "get /admin/employees/{id}": adminEmployeeResponseEnvelopeSchema,
  "post /admin/employees": adminEmployeeResponseEnvelopeSchema,
  "patch /admin/employees/{id}": adminEmployeeResponseEnvelopeSchema,
  "delete /admin/employees/{id}": adminEmployeeDeleteResponseSchema,
  "put /admin/employees/{id}/pin": adminPinSetResponseSchema,
  "post /admin/employees/{id}/pin": adminPinVerifyResponseSchema,
  "get /admin/segments": adminSegmentsResponseSchema,
  "post /admin/segments": adminSegmentResponseEnvelopeSchema,
  "get /admin/shifts": adminShiftsResponseSchema,
  "post /admin/shifts": adminShiftResponseEnvelopeSchema,
  "get /admin/segments/{id}/members": adminSegmentMembersResponseSchema,
  "post /admin/segments/{id}/members": adminSegmentMembersMutationResponseSchema,
  "post /admin/campaigns/{id}/execute": adminCampaignExecuteResponseSchema,
  "get /admin/operator-notes": adminOperatorNotesResponseSchema,
  "post /admin/operator-notes": adminOperatorNoteCreateResponseSchema,
  "get /admin/crm/notes": adminCrmNotesResponseSchema,
  "post /admin/crm/notes": adminCrmNoteCreateResponseSchema,
  "delete /admin/crm/notes/{id}": adminMutationOkResponseSchema,
  "get /admin/crm/operations": adminCrmOperationsResponseSchema,
  "post /admin/crm/operations": adminCrmOperationResponseSchema,
  "patch /admin/crm/operations": adminCrmOperationResponseSchema,
  "delete /admin/crm/operations": adminMutationOkResponseSchema,
  "get /admin/crm/bridge": adminCrmBridgeResponseSchema,
  "post /admin/crm/bridge": adminCrmBridgeMutationResponseSchema,
  "get /admin/crm/nango": adminNangoConnectionsResponseSchema,
  "post /admin/crm/nango": adminNangoMutationResponseSchema,
  "delete /admin/crm/nango": z.object({ data: z.object({ disconnected: z.literal(true) }).strict() }).strict(),
  "get /admin/payments/connections": adminNangoConnectionsResponseSchema,
  "post /admin/payments/connections": adminNangoMutationResponseSchema,
  "post /admin/payments/connect-session": adminNangoMutationResponseSchema,
  "post /admin/payments/connections/reconnect": adminNangoMutationResponseSchema,
  "post /admin/payments/{id}/mark-review": adminMutationOkResponseSchema,
  "post /admin/payments/{id}/retry": adminPaymentRetryResponseSchema,
  "post /admin/crm/nango/connect-session": adminNangoMutationResponseSchema,
  "post /admin/cms/navigation/publish": adminCmsNavigationResponseSchema,
  "post /admin/cms/blog/bulk": adminCmsBlogBulkResponseSchema,
  "patch /admin/reviews/{id}": adminReviewMutationResponseSchema,
  "post /admin/chat-orders/{id}/status": adminChatOrderStatusResponseSchema,
  "post /admin/loyalty/points": adminLoyaltyAccountResponseEnvelopeSchema,
  "post /pos/commerce/lookup": adminPosCommerceLookupResponseSchema,
  "post /checkout/preview": checkoutPreviewResponseSchema,
  "post /orders/return": storefrontReturnResponseSchema,
  "post /reviews/report/{id}": adminMutationOkResponseSchema,
  "post /integrations/channels/webhook": adminChannelWebhookResponseSchema,
  "post /integrations/chat-orders/intake": adminChatOrderIntakeResponseSchema,
  "post /integrations/couriers/telemetry": adminCourierTelemetryResponseSchema,
  "post /admin/delivery-logistics/operations": adminDeliveryOperationMutationResponseSchema,
  "post /admin/terminal-open-drawer": adminTerminalMutationResponseSchema,
  "post /admin/terminal-print-label": adminTerminalMutationResponseSchema,
  "post /admin/terminal-print": adminTerminalMutationResponseSchema,
  "post /admin/tracking-capabilities/revoke": adminTrackingCapabilityRevokeResponseSchema,
  "delete /admin/payments/connections": z.object({ data: z.object({ disconnected: z.literal(true) }).strict() }).strict(),
  "get /admin/integrations/pancake": adminPancakeIntegrationResponseSchema,
  "get /admin/delivery-logistics/operations": adminDeliveryOperationsResponseSchema,
  "get /admin/delivery-logistics": adminDeliveryLogisticsResponseSchema,
  "get /admin/delivery-logistics/shipments": adminDeliveryShipmentResponseSchema,
  "post /admin/delivery-logistics/shipments": adminDeliveryShipmentResponseSchema,
  "get /admin/inventory/transfers": adminInventoryTransfersResponseSchema,
  "post /admin/inventory/transfers": adminInventoryTransferResponseSchema,
  "get /admin/inventory/transfers/{id}": adminInventoryTransferResponseSchema,
  "post /admin/inventory/transfers/{id}": adminInventoryTransferResponseSchema,
  "get /admin/invoices": adminInvoicesResponseSchema,
  "post /admin/invoices": adminInvoiceResponseSchema,
  "post /admin/invoices/{id}/lifecycle": adminInvoiceResponseSchema,
  "get /admin/receipts": adminReceiptResponseSchema,
  "post /admin/receipts": adminReceiptResponseSchema,
  "get /admin/pos/enterprise": adminPosEnterpriseResponseSchema,
  "get /admin/shifts/{id}/reconciliation": adminShiftReconciliationResponseSchema,
  "post /admin/pos/enterprise": adminPosEnterpriseMutationResponseSchema,
  "get /admin/reviews": adminReviewsResponseSchema,
  "get /admin/voids": adminVoidsResponseSchema,
  "post /admin/voids": adminVoidResponseEnvelopeSchema,
} as const;
