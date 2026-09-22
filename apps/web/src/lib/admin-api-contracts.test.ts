import test from "node:test";
import assert from "node:assert/strict";
import {
  adminInventoryResponseSchema,
  adminInventoryLedgerResponseSchema,
  adminAuditLogsResponseSchema,
  adminWorkflowEntitiesResponseSchema,
  adminCampaignsResponseSchema,
  adminEmployeesResponseSchema,
  adminSegmentsResponseSchema,
  adminShiftsResponseSchema,
  adminSegmentMembersResponseSchema,
  adminCampaignExecuteResponseSchema,
  adminOperatorNotesResponseSchema,
  adminReviewsResponseSchema,
  adminVoidsResponseSchema,
  adminReconciliationResponseSchema,
  adminPaymentHealthResponseSchema,
  adminResponseContracts,
  adminTasksTodayResponseSchema,
  accountProfileStatusResponseSchema,
  adminCmsAnnouncementResponseSchema,
  adminCmsNavigationResponseSchema,
  adminStorefrontHomeResponseSchema,
  adminCmsPagesResponseSchema,
  adminCmsBlogsResponseSchema,
  adminCmsExperimentsResponseSchema,
  adminCmsFormSettingsResponseSchema,
  adminCmsFormSubmissionsResponseSchema,
  adminCmsMediaResponseSchema,
  adminCmsMediaDetailResponseSchema,
  adminCmsMediaDeleteResponseSchema,
  adminCatalogProductMutationResponseSchema,
  adminCatalogProductDeleteResponseSchema,
  adminInventoryStreamResponseSchema,
  adminShiftReconciliationResponseSchema,
  checkoutAvailablePaymentMethodsResponseSchema,
  integrationsCouriersResponseSchema,
  posCommerceQuickProductsResponseSchema,
  posCommerceSearchResponseSchema,
  posCommerceSuggestionsResponseSchema,
  storefrontReviewsResponseSchema,
  storefrontReviewCreateResponseSchema,
  shopProductResponseSchema,
  cartBindTokenResponseSchema,
  cmsPageMutationsResponseSchema,
  adminDeviceResponseEnvelopeSchema,
  adminInventoryAdjustmentResponseSchema,
  adminCmsRedirectBulkResponseSchema,
  adminCmsRedirectImportResponseSchema,
  adminOrderStatusResponseSchema,
  adminOrderRefundResponseSchema,
  adminBulkFulfillmentResponseSchema,
  adminPaymentRetryResponseSchema,
  adminMutationOkResponseSchema,
  adminNangoMutationResponseSchema,
  adminTerminalMutationResponseSchema,
  adminTrackingCapabilityRevokeResponseSchema,
  adminPinApprovalResponseSchema,
  adminShiftCloseResponseSchema,
  adminWorkflowTransitionResponseSchema,
  adminCmsBlogBulkResponseSchema,
  adminReviewMutationResponseSchema,
  adminChatOrderStatusResponseSchema,
  adminPosCommerceLookupResponseSchema,
  checkoutPreviewResponseSchema,
  storefrontReturnResponseSchema,
  adminChatOrderIntakeResponseSchema,
  adminChannelWebhookResponseSchema,
  adminCourierTelemetryResponseSchema,
  adminDeliveryOperationMutationResponseSchema,
  legacyRouteRetiredResponseSchema,
} from "./admin-api-contracts";

test("runtime response registry covers the hardened route families", () => {
  for (const key of [
    "get /admin/inventory",
    "get /admin/payments",
    "get /admin/loyalty",
    "get /admin/offline-queue",
    "get /account/profile/status",
  ]) {
    assert.ok(adminResponseContracts[key as keyof typeof adminResponseContracts]);
  }
});

test("inventory response contracts reject malformed rows", () => {
  assert.equal(
    adminInventoryResponseSchema.safeParse({
      rows: [{ variantId: "v1", available: "not-a-number" }],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    }).success,
    false,
  );
});

test("inventory stream contracts preserve bounded data and safe error events", () => {
  assert.equal(adminInventoryStreamResponseSchema.safeParse({ rows: [], page: 1, pageSize: 25, total: 0 }).success, true);
  assert.equal(adminInventoryStreamResponseSchema.safeParse({ code: "INVENTORY_STREAM_FAILED", retryable: true }).success, true);
  assert.equal(adminInventoryStreamResponseSchema.safeParse({ rows: [], page: 1, pageSize: 10, total: 0 }).success, false);
});

test("shift reconciliation contracts preserve tenant-safe settlement evidence", () => {
  const result = adminShiftReconciliationResponseSchema.safeParse({
    shift: {
      id: "shift-1", employee_id: "employee-1", device_name: "Terminal 01", opened_at: "2026-09-21T00:00:00.000Z",
      closed_at: null, opening_cash: 1000, closing_cash: null, expected_cash: 1000, notes: null, status: "open",
    },
    voids: [], voidCount: 0, voidAmountMinor: 0, medusaOrdersForShift: 0, medusaSalesTotalMinor: 0,
    openingCash: 1000, closingCash: null, expectedCash: 1000, cashVariance: null,
  });
  assert.equal(result.success, true);
  assert.equal(adminShiftReconciliationResponseSchema.safeParse({ shift: { id: "shift-1" } }).success, false);
});

test("checkout availability contracts preserve safe provider capability states", () => {
  assert.equal(checkoutAvailablePaymentMethodsResponseSchema.safeParse({ ok: true, keys: ["STRIPE", "COD"], code: "OK", error: null, message: null }).success, true);
  assert.equal(checkoutAvailablePaymentMethodsResponseSchema.safeParse({ ok: false, keys: [], code: "WORKER_UNAVAILABLE", error: "worker_unreachable", message: "Try again" }).success, true);
  assert.equal(checkoutAvailablePaymentMethodsResponseSchema.safeParse({ ok: true, keys: ["BITCOIN"], code: "OK", error: null, message: null }).success, false);
});

test("retired checkout completion contract rejects the former success payload", () => {
  assert.equal(
    legacyRouteRetiredResponseSchema.safeParse({
      error: "Legacy cart completion is disabled",
      code: "LEGACY_ROUTE_DISABLED",
    }).success,
    true,
  );
  assert.equal(
    legacyRouteRetiredResponseSchema.safeParse({
      ok: true,
      orderId: "order-1",
      redirectUrl: "https://shop.test/track/order-1",
      code: "OK",
    }).success,
    false,
  );
});

test("courier registry contracts reject incomplete integration capabilities", () => {
  assert.equal(integrationsCouriersResponseSchema.safeParse({ couriers: [{ slug: "jtexpress-ph", label: "J&T", region: "PH", supportsLabels: false }] }).success, true);
  assert.equal(integrationsCouriersResponseSchema.safeParse({ couriers: [{ slug: "jtexpress-ph", region: "PH" }] }).success, false);
});

test("POS commerce contracts bound product reads and reject invalid pricing", () => {
  const product = { variantId: "variant-1", name: "Album", sku: "SKU-1", size: "", color: "", price: 1299 };
  assert.equal(posCommerceQuickProductsResponseSchema.safeParse({ products: [product] }).success, true);
  assert.equal(posCommerceSearchResponseSchema.safeParse({ products: [product] }).success, true);
  assert.equal(posCommerceSuggestionsResponseSchema.safeParse({ suggestions: [product] }).success, true);
  assert.equal(posCommerceSearchResponseSchema.safeParse({ products: [{ ...product, price: -1 }] }).success, false);
});

test("storefront review contracts bound public reads and mutation acknowledgements", () => {
  const review = { id: "review-1", rating: 5, author_name: "Customer", image_url: null, body: "Great", created_at: "2026-09-21T00:00:00.000Z", product_slug: "album", medusa_product_id: "product-1", is_verified_buyer: true, helpful_votes: 0 };
  assert.equal(storefrontReviewsResponseSchema.safeParse({ reviews: [review], nextCursor: null }).success, true);
  assert.equal(storefrontReviewCreateResponseSchema.safeParse({ ok: true, status: "pending", isVerifiedBuyer: true }).success, true);
  assert.equal(storefrontReviewsResponseSchema.safeParse({ reviews: [{ ...review, helpful_votes: -1 }], nextCursor: null }).success, false);
});

test("shop product contracts enforce storefront-safe variant and gallery shapes", () => {
  const product = {
    id: "product-1", slug: "album", name: "Album", description: null, category: null, status: "published", brand: null, createdAt: null,
    images: [], gallerySlides: [], variants: [{ id: "variant-1", productId: "product-1", sku: "SKU-1", barcode: null, type: "", finish: "", pickupConfig: "", bodyWood: "", condition: "", skillLevel: "", shippingSpeed: "", price: 100, compareAtPrice: null, cost: null, manageInventory: true, inventoryQuantity: 1, isActive: true }],
    videoUrl: null, weightKg: null, dimensionsLabel: null, material: null, lifestyleImageUrl: null, hotspots: [], relatedHandles: [], seoDescription: null, guitarSpecs: null, audioDemos: [], trustContent: null,
  };
  assert.equal(shopProductResponseSchema.safeParse({ product }).success, true);
  assert.equal(shopProductResponseSchema.safeParse({ product: { ...product, variants: [{ ...product.variants[0], cost: 10 }] } }).success, false);
});

test("cart bind-token contracts reject missing or undersized proof", () => {
  assert.equal(cartBindTokenResponseSchema.safeParse({ token: "a".repeat(32) }).success, true);
  assert.equal(cartBindTokenResponseSchema.safeParse({ token: "short" }).success, false);
});

test("CMS mutation history contracts preserve bounded tenant identity", () => {
  const row = { id: "11111111-1111-4111-8111-111111111111", page_id: "22222222-2222-4222-8222-222222222222", organization_id: "org-1", revision: 1, sequence: 0, mutation: { type: "update" }, created_at: "2026-09-21T00:00:00.000Z" };
  assert.equal(cmsPageMutationsResponseSchema.safeParse({ data: [row] }).success, true);
  assert.equal(cmsPageMutationsResponseSchema.safeParse({ data: [{ ...row, organization_id: "" }] }).success, false);
});

test("device mutation contracts preserve typed terminal state", () => {
  const device = { id: "11111111-1111-4111-8111-111111111111", name: "Terminal 01", type: "terminal", ip_address: null, is_active: true, config: {}, last_seen_at: null, created_at: "2026-09-21T00:00:00.000Z" };
  assert.equal(adminDeviceResponseEnvelopeSchema.safeParse({ data: device }).success, true);
  assert.equal(adminDeviceResponseEnvelopeSchema.safeParse({ data: { ...device, type: "unknown" } }).success, false);
});

test("inventory adjustment contracts preserve bounded stock outcomes", () => {
  const result = adminInventoryAdjustmentResponseSchema.safeParse({ data: { productId: "product-1", variantId: "variant-1", locationId: "location-1", stockedQuantity: 12, availableQuantity: 10, delta: 4, reason: "receive" } });
  assert.equal(result.success, true);
  assert.equal(adminInventoryAdjustmentResponseSchema.safeParse({ data: { productId: "product-1" } }).success, false);
});

test("inventory ledger response contracts enforce the persisted audit shape", () => {
  const result = adminInventoryLedgerResponseSchema.safeParse({
    data: [{
      id: "audit-1",
      created_at: "2026-09-21T00:00:00.000Z",
      actor_email: "staff@example.com",
      reason: "staff_catalog_stock_set",
      reference_type: "inventory_adjustment",
      reference_id: "ref-1",
      product_id: "product-1",
      variant_id: "variant-1",
      location_id: null,
      quantity_before: 1,
      quantity_after: 3,
      quantity_delta: 2,
      correlation_id: "request-1",
    }],
    organization_id: "org-1",
  });
  assert.equal(result.success, true);
  assert.equal(adminInventoryLedgerResponseSchema.safeParse({ data: [{ id: "audit-1" }], organization_id: "org-1" }).success, false);
});

test("payment health contracts reject unknown provider state", () => {
  const result = adminPaymentHealthResponseSchema.safeParse({
    environment: "preview",
    isProduction: false,
    providers: {
      stripe: { enabled: false, webhookConfigured: false },
      paypal: { enabled: false, webhookConfigured: false, sandboxMode: true },
      xendit: { enabled: false, webhookConfigured: false },
      cod: { enabled: true, webhookConfigured: true },
    },
    warnings: [],
    ok: true,
    unexpected: true,
  });
  assert.equal(result.success, false);
});

test("profile status contracts preserve the unauthenticated and unavailable states", () => {
  assert.equal(accountProfileStatusResponseSchema.safeParse({ authenticated: false, complete: false }).success, true);
  assert.equal(accountProfileStatusResponseSchema.safeParse({ authenticated: true, available: false, error: "temporarily unavailable" }).success, true);
});

test("empty task responses remain valid and bounded", () => {
  assert.deepEqual(adminTasksTodayResponseSchema.parse({ tasks: [] }), { tasks: [] });
});

test("audit log response contracts preserve actor and structured detail fields", () => {
  assert.equal(adminAuditLogsResponseSchema.safeParse({ entries: [{
    id: "audit-1",
    action: "catalog.update",
    resource: "product",
    details: { productId: "product-1" },
    created_at: "2026-09-21T00:00:00.000Z",
    actor_id: "user-1",
    users: { email: "staff@example.com", name: "Staff" },
  }] }).success, true);
  assert.equal(adminAuditLogsResponseSchema.safeParse({ entries: [{ id: "audit-1" }] }).success, false);
});

test("workflow response contracts enforce normalized lifecycle rows", () => {
  assert.equal(adminWorkflowEntitiesResponseSchema.safeParse({ rows: [{
    id: "workflow-1",
    entity_type: "campaign",
    entity_id: "campaign-1",
    state: "published",
    previous_state: "approved",
    notes: null,
    actor_email: "staff@example.com",
    updated_at: "2026-09-21T00:00:00.000Z",
  }] }).success, true);
  assert.equal(adminWorkflowEntitiesResponseSchema.safeParse({ rows: [{ id: "workflow-1" }] }).success, false);
});

test("campaign response contracts reject unnormalized provider rows", () => {
  assert.equal(adminCampaignsResponseSchema.safeParse({ data: [{
    id: "campaign-1",
    name: "Winback",
    type: "winback",
    segment_id: null,
    subject: "Come back",
    body_template: "Hello",
    channel: "email",
    is_active: true,
    last_run_at: null,
    schedule_cron: null,
    created_at: "2026-09-21T00:00:00.000Z",
    organization_id: "org-1",
  }] }).success, true);
  assert.equal(adminCampaignsResponseSchema.safeParse({ data: [{ id: "campaign-1", type: "sms" }] }).success, false);
});

test("employee response contracts include tenant identity and reject incomplete rows", () => {
  assert.equal(adminEmployeesResponseSchema.safeParse({ data: [{
    id: "employee-1",
    user_id: null,
    full_name: "Staff",
    email: "staff@example.com",
    phone: null,
    role: "cashier",
    is_active: true,
    hired_at: null,
    metadata: {},
    created_at: "2026-09-21T00:00:00.000Z",
    updated_at: "2026-09-21T00:00:00.000Z",
    organization_id: "org-1",
  }] }).success, true);
  assert.equal(adminEmployeesResponseSchema.safeParse({ data: [{ id: "employee-1" }] }).success, false);
});

test("segment and shift response contracts reject invalid lifecycle data", () => {
  assert.equal(adminSegmentsResponseSchema.safeParse({ data: [{
    id: "segment-1", name: "VIP", description: null, rule_type: "manual", rule_config: {},
    auto_refresh: false, member_count: 0, last_refreshed_at: null,
    created_at: "2026-09-21T00:00:00.000Z", organization_id: "org-1",
  }] }).success, true);
  assert.equal(adminShiftsResponseSchema.safeParse({ data: [{
    id: "shift-1", employee_id: "employee-1", device_name: "Terminal 01",
    opened_at: "2026-09-21T00:00:00.000Z", closed_at: null, opening_cash: 0,
    closing_cash: null, expected_cash: null, notes: null, status: "open",
  }] }).success, true);
  assert.equal(adminShiftsResponseSchema.safeParse({ data: [{ id: "shift-1", status: "unknown" }] }).success, false);
});

test("member and queued campaign responses preserve bounded action results", () => {
  assert.equal(adminSegmentMembersResponseSchema.safeParse({ data: [{ customer_email: "customer@example.com", medusa_customer_id: null }] }).success, true);
  assert.equal(adminCampaignExecuteResponseSchema.safeParse({ queued: true, jobId: "job-1" }).success, true);
  assert.equal(adminCampaignExecuteResponseSchema.safeParse({ queued: true }).success, false);
});

test("operator note responses preserve bounded tenant-scoped notes", () => {
  assert.equal(adminOperatorNotesResponseSchema.safeParse({ notes: [{
    id: "note-1", body: "Follow up", author_email: "staff@example.com", created_at: "2026-09-21T00:00:00.000Z",
  }] }).success, true);
  assert.equal(adminOperatorNotesResponseSchema.safeParse({ notes: [{ id: "note-1" }] }).success, false);
});

test("review response contracts enforce moderation and abuse-signal fields", () => {
  assert.equal(adminReviewsResponseSchema.safeParse({ reviews: [{
    id: "review-1", product_slug: "album", medusa_product_id: null, rating: 5,
    author_name: "Customer", body: "Great", status: "approved",
    created_at: "2026-09-21T00:00:00.000Z", customer_email: "customer@example.com",
    medusa_customer_id: null, verified_medusa_order_id: null,
    moderated_by_staff_email: null, is_verified_buyer: false, risk_score: 0,
    shadow_banned: false, moderated_at: null, moderation_note: null, open_report_count: 0,
  }] }).success, true);
  assert.equal(adminReviewsResponseSchema.safeParse({ reviews: [{ id: "review-1", status: "unknown" }] }).success, false);
});

test("void response contracts enforce bounded POS audit rows", () => {
  assert.equal(adminVoidsResponseSchema.safeParse({ data: [{
    id: "void-1", shift_id: null, employee_id: "employee-1", approved_by: null,
    order_id: "order-1", line_item_id: null, action: "void_item", amount: 10,
    reason: "Damaged", pin_verified: true, created_at: "2026-09-21T00:00:00.000Z",
  }] }).success, true);
  assert.equal(adminVoidsResponseSchema.safeParse({ data: [{ id: "void-1", action: "unknown" }] }).success, false);
});

test("reconciliation response contracts preserve bounded provider settlement evidence", () => {
  const result = adminReconciliationResponseSchema.safeParse({
    period: "Last 7 days",
    rows: [{
      date: "2026-09-21", provider: "stripe", medusaOrderCount: 1, medusaTotalMinor: 1000,
      providerConfirmedCount: 1, providerConfirmedMinor: 1000, openAttemptCount: 0,
      problemAttemptCount: 0, discrepancyMinor: 0, status: "matched",
    }],
    totalMedusaMinor: 1000, totalProviderConfirmedMinor: 1000, totalDiscrepancyMinor: 0,
    paymentAttemptsStaleFinalize: 0, paymentAttemptsNeedsReview: 0,
    recentProblemAttempts: [], providerReconciliationArtifacts: [], providerSettlementRecords: [],
  });
  assert.equal(result.success, true);
  assert.equal(adminReconciliationResponseSchema.safeParse({ rows: [] }).success, false);
});

test("CMS announcement and navigation contracts reject drifted response shapes", () => {
  assert.equal(adminCmsAnnouncementResponseSchema.safeParse({ data: { rows: [], analytics: {} } }).success, true);
  assert.equal(adminCmsAnnouncementResponseSchema.safeParse({ data: { rows: [{ id: "a", body: "x" }], analytics: {} } }).success, false);
  assert.equal(adminCmsNavigationResponseSchema.safeParse({ data: {
    headerLinks: [], headerLinksMobile: [], footerColumns: [], footerBottomLinks: [], socialLinks: [],
  }, meta: { hasDraft: false } }).success, true);
  assert.equal(adminCmsNavigationResponseSchema.safeParse({ data: {}, meta: { hasDraft: false } }).success, false);
});

test("storefront home response contracts preserve bounded editor state", () => {
  assert.equal(adminStorefrontHomeResponseSchema.safeParse({ data: {}, devMode: false }).success, true);
  assert.equal(adminStorefrontHomeResponseSchema.safeParse({ data: { unexpected: true } }).success, false);
});

test("CMS page and blog contracts reject incomplete persisted rows", () => {
  const page = {
    id: "page-1", organization_id: "org-1", slug: "about", locale: "en", page_type: "static" as const,
    title: "About", body: "Body", blocks: [], tree: [], status: "published" as const,
    published_at: null, scheduled_publish_at: null, preview_token: null, meta_title: null,
    meta_description: null, canonical_url: null, og_image_url: null, json_ld: null,
    version: 1, created_at: "2026-09-21T00:00:00.000Z", updated_at: "2026-09-21T00:00:00.000Z",
    parent_slug: null, breadcrumb_label: null,
  };
  assert.equal(adminCmsPagesResponseSchema.safeParse({ data: [page] }).success, true);
  assert.equal(adminCmsPagesResponseSchema.safeParse({ data: [{ ...page, version: 0 }] }).success, false);
  const blog = {
    id: "blog-1", slug: "news", locale: "en", title: "News", excerpt: "", body: "Body",
    cover_image_url: null, author_name: null, tags: [], status: "draft" as const,
    published_at: null, scheduled_publish_at: null, preview_token: null, meta_title: null,
    meta_description: null, canonical_url: null, og_image_url: null, rss_include: true,
    json_ld: null, created_at: "2026-09-21T00:00:00.000Z", updated_at: "2026-09-21T00:00:00.000Z",
  };
  assert.equal(adminCmsBlogsResponseSchema.safeParse({ data: [blog] }).success, true);
  assert.equal(adminCmsBlogsResponseSchema.safeParse({ data: [{ ...blog, tags: ["x".repeat(81)] }] }).success, false);
});

test("CMS experiment and form settings contracts preserve bounded configuration", () => {
  assert.equal(adminCmsExperimentsResponseSchema.safeParse({ data: [{
    id: "exp-1", organization_id: "org-1", experiment_key: "hero", name: "Hero",
    variants: [{ id: "a", label: "A" }], active: true, updated_at: "2026-09-21T00:00:00.000Z",
    starts_at: null, ends_at: null, traffic_cap_pct: 50, target_page_slug: null,
    target_component_key: null, impressions: 0, conversions: 0,
  }] }).success, true);
  assert.equal(adminCmsExperimentsResponseSchema.safeParse({ data: [{ id: "exp-1" }] }).success, false);
  assert.equal(adminCmsFormSettingsResponseSchema.safeParse({ data: {
    id: "settings-1", webhook_url: null, notify_email: "ops@example.com", updated_at: "2026-09-21T00:00:00.000Z",
  } }).success, true);
  assert.equal(adminCmsFormSettingsResponseSchema.safeParse({ data: { id: "settings-1", notify_email: "bad" } }).success, false);
});

test("CMS form submission contracts bound payloads and preserve moderation fields", () => {
  const row = {
    id: "submission-1", form_key: "contact", payload: { message: "Hello" },
    created_at: "2026-09-21T00:00:00.000Z", ip_hash: null, read_at: null,
    assigned_to: null, spam_score: 0,
  };
  assert.equal(adminCmsFormSubmissionsResponseSchema.safeParse({ data: [row], meta: { total: 1 } }).success, true);
  assert.equal(adminCmsFormSubmissionsResponseSchema.safeParse({ data: [{ ...row, spam_score: 2 }], meta: { total: 1 } }).success, false);
  assert.equal(adminCmsFormSubmissionsResponseSchema.safeParse({ data: [row], meta: { total: -1 } }).success, false);
});

test("CMS media contracts preserve bounded storage metadata and delete state", () => {
  const row = {
    id: "media-1", storage_path: "public/file.png", public_url: "https://cdn.example.com/file.png",
    alt_text: "Cover", mime_type: "image/png", width: 100, height: 100,
    created_at: "2026-09-21T00:00:00.000Z", deleted_at: null, display_name: "file.png",
    byte_size: 1000, tags: ["hero"], organization_id: "org-1",
  };
  assert.equal(adminCmsMediaResponseSchema.safeParse({ data: [row] }).success, true);
  assert.equal(adminCmsMediaDetailResponseSchema.safeParse({ data: { row, refs: [] } }).success, true);
  assert.equal(adminCmsMediaDeleteResponseSchema.safeParse({ ok: true, storageCleanup: "removed" }).success, true);
  assert.equal(adminCmsMediaDeleteResponseSchema.safeParse({ ok: true }).success, false);
});

test("catalog mutation contracts preserve provider and storefront outcomes", () => {
  const mutation = {
    productId: "product-1", mutationClassification: "sellability_affecting" as const,
    stripeCatalogSync: { state: "synced" as const, paymentLinkUrl: null }, storefrontInvalidation: "ok",
  };
  assert.equal(adminCatalogProductMutationResponseSchema.safeParse(mutation).success, true);
  assert.equal(adminCatalogProductMutationResponseSchema.safeParse({ ...mutation, mutationClassification: "unknown" }).success, false);
  assert.equal(adminCatalogProductDeleteResponseSchema.safeParse({
    deleted: true, mutationClassification: "editorial_only", storefrontInvalidation: "ok",
    stripeCatalogArchive: { state: "no_artifacts" },
  }).success, true);
});

test("CMS redirect bulk and import responses are bounded and explicit", () => {
  assert.equal(adminCmsRedirectBulkResponseSchema.safeParse({ data: { updated: 2 } }).success, true);
  assert.equal(adminCmsRedirectBulkResponseSchema.safeParse({ data: { updated: -1 } }).success, false);
  assert.equal(adminCmsRedirectImportResponseSchema.safeParse({ data: { imported: 1, warnings: ["Row 2: skipped"] } }).success, true);
  assert.equal(adminCmsRedirectImportResponseSchema.safeParse({ data: { imported: 1, warnings: ["x".repeat(501)] } }).success, false);
});

test("order mutation responses preserve lifecycle and settlement evidence", () => {
  assert.equal(adminOrderStatusResponseSchema.safeParse({ status: "shipped" }).success, true);
  assert.equal(adminOrderStatusResponseSchema.safeParse({ status: "unknown" }).success, false);
  assert.equal(adminOrderRefundResponseSchema.safeParse({ ok: true, payment_id: "pay-1", provider: "stripe", refund_id: "ref-1", provider_status: "succeeded", amount_minor: 100 }).success, true);
  assert.equal(adminOrderRefundResponseSchema.safeParse({ ok: true, payment_id: "pay-1", provider: "other", refund_id: null, provider_status: null, amount_minor: 100 }).success, false);
  assert.equal(adminBulkFulfillmentResponseSchema.safeParse({ total: 1, succeeded: 1, skipped: 0, failed: 0, results: [{ orderId: "order-1", ok: true, fulfillment_status: "fulfilled" }] }).success, true);
  assert.equal(adminBulkFulfillmentResponseSchema.safeParse({ total: 1, succeeded: 1, skipped: 0, failed: 0, results: [{ orderId: "order-1", ok: true, email: "not-an-email" }] }).success, false);
});

test("payment mutation responses preserve provider/session and retry contracts", () => {
  assert.equal(adminMutationOkResponseSchema.safeParse({ ok: true }).success, true);
  assert.equal(adminPaymentRetryResponseSchema.safeParse({ ok: true, orderId: "order-1", redirectUrl: "https://example.test/orders/order-1" }).success, true);
  assert.equal(adminPaymentRetryResponseSchema.safeParse({ ok: true, orderId: "order-1", redirectUrl: "/orders/order-1" }).success, false);
  assert.equal(adminNangoMutationResponseSchema.safeParse({ data: { session_token: "token" } }).success, true);
});

test("terminal and tracking mutations expose only verified acknowledgements", () => {
  assert.equal(adminTerminalMutationResponseSchema.safeParse({ ok: true }).success, true);
  assert.equal(adminTerminalMutationResponseSchema.safeParse({ ok: true, message: "printed" }).success, false);
  assert.equal(adminTrackingCapabilityRevokeResponseSchema.safeParse({ ok: true, revoked: true }).success, true);
  assert.equal(adminTrackingCapabilityRevokeResponseSchema.safeParse({ ok: true, revoked: false }).success, false);
});

test("approval, shift close, and workflow responses are explicitly bounded", () => {
  assert.equal(adminPinApprovalResponseSchema.safeParse({ approved: true }).success, true);
  assert.equal(adminPinApprovalResponseSchema.safeParse({ approved: false, reason: "invalid_pin" }).success, true);
  assert.equal(adminPinApprovalResponseSchema.safeParse({ approved: false, reason: "database_error" }).success, false);
  assert.equal(adminWorkflowTransitionResponseSchema.safeParse({ state: "approved" }).success, true);
  assert.equal(adminShiftCloseResponseSchema.safeParse({ data: { shift: {
    id: "shift-1", employee_id: "employee-1", device_name: "POS", opened_at: "2026-09-21T00:00:00.000Z", closed_at: "2026-09-21T01:00:00.000Z",
    opening_cash: 100, closing_cash: 120, expected_cash: 120, notes: null, status: "closed",
  }, reconciliation: {
    id: "rec-1", organization_id: "org-1", shift_id: "shift-1", idempotency_key: "key-1", opening_cash: 100, cash_sales: 20, cash_refunds: 0, payouts: 0,
    expected_cash: 120, counted_cash: 120, variance: 0, created_by_email: "staff@example.com",
  } } }).success, true);
});

test("CMS publish, bulk delete, and review mutation responses reject drift", () => {
  assert.equal(adminCmsBlogBulkResponseSchema.safeParse({ ok: true, deleted: 2 }).success, true);
  assert.equal(adminCmsBlogBulkResponseSchema.safeParse({ ok: true, deleted: -1 }).success, false);
  assert.equal(adminReviewMutationResponseSchema.safeParse({ ok: true, review: { id: "review-1", status: "approved" } }).success, true);
  assert.equal(adminReviewMutationResponseSchema.safeParse({ ok: true, review: { id: "review-1", status: "unknown" } }).success, false);
});

test("chat-order, loyalty, and POS lookup responses are bounded", () => {
  assert.equal(adminChatOrderStatusResponseSchema.safeParse({ id: "ticket-1", status: "processing" }).success, true);
  assert.equal(adminChatOrderStatusResponseSchema.safeParse({ id: "ticket-1", status: "completed" }).success, false);
  assert.equal(adminPosCommerceLookupResponseSchema.safeParse({ id: "variant-1", sku: "SKU-1", size: "M", color: "Black", price: 100, products: { name: "Shirt" } }).success, true);
  assert.equal(adminPosCommerceLookupResponseSchema.safeParse({ id: "variant-1", sku: "SKU-1", size: "M", color: "Black", price: -1, products: { name: "Shirt" } }).success, false);
});

test("checkout, return, and review-report responses are contract-backed", () => {
  assert.equal(checkoutPreviewResponseSchema.safeParse({ subtotal: 10, taxTotal: 0, shippingTotal: 0, discountTotal: 0, total: 10, currencyCode: "PHP", lineSubtotalsByVariantId: { v1: 10 }, quoteFingerprint: "a".repeat(64), variantIds: ["v1"], productIds: ["p1"], shippingMethodIds: [], regionId: null, shippingOptions: [], appliedShippingOptionId: null }).success, true);
  assert.equal(storefrontReturnResponseSchema.safeParse({ ok: true, order_id: "order-1", items: [{ item_id: "item-1", quantity: 1 }], auditStatus: "recorded" }).success, true);
  assert.equal(storefrontReturnResponseSchema.safeParse({ ok: true, order_id: "order-1", items: [] }).success, false);
});

test("integration acknowledgements and persisted telemetry are bounded", () => {
  assert.equal(adminChannelWebhookResponseSchema.safeParse({ ok: true, deduplicated: true }).success, true);
  assert.equal(adminChatOrderIntakeResponseSchema.safeParse({ id: "ticket-1", draftOrderId: "cart-1", status: "draft_created" }).success, true);
  assert.equal(adminCourierTelemetryResponseSchema.safeParse({ data: { id: "telemetry-1", shipment_id: "ship-1" } }).success, true);
});

test("delivery operation mutations reject unbounded result envelopes", () => {
  assert.equal(adminDeliveryOperationMutationResponseSchema.safeParse({ data: { shipment_id: "ship-1", status: "delivered" } }).success, true);
  assert.equal(adminDeliveryOperationMutationResponseSchema.safeParse({ data: Object.fromEntries(Array.from({ length: 101 }, (_, index) => [`field-${index}`, true])) }).success, false);
});
