import {
  withWorkerDatabase,
  type WorkerDatabaseEnv,
  type WorkerDatabaseRole,
  type WorkerDatabaseClient,
} from "./database.ts";
import {
  handleCatalogProductRequest,
  handleCatalogProductsRequest,
  handleCatalogSearchSuggestionsRequest,
  handleSocialProofRequest,
  handleCollectionsRequest,
  handleCatalogCategoriesRequest,
  handleCollectionRequest,
  handleRegionsRequest,
} from "./catalog.ts";
import {
  handleAddCartLineRequest,
  handleCartLineQuantityRequest,
  handleCreateCartRequest,
  handleCartUpdateRequest,
  handleCartRequest,
} from "./cart.ts";
import { handleCartReconcileRequest } from "./cart-reconcile.ts";
import { handleCartMergeRequest } from "./cart-merge.ts";
import { handleInventoryAvailabilityRequest } from "./inventory.ts";
import {
  handleCheckoutPreviewRequest,
  handleCheckoutSessionRequest,
  type CheckoutEnv,
} from "./checkout.ts";
import {
  enqueueWorkerWebhookRequest,
  type WorkerWebhookEnv,
} from "./webhooks.ts";
import {
  handleCustomerOrderDetailRequest,
  handleCustomerOrdersRequest,
  type OrderReadEnv,
} from "./orders.ts";
import { handleCustomerReceiptRequest } from "./orders.ts";
import { handleCustomerProfileRequest } from "./profile.ts";
import { handleCustomerMarketingPreferencesRequest } from "./marketing-preferences.ts";
import { handleCustomerOrderPreferencesRequest } from "./order-preferences.ts";
import { handleCustomerLoyaltyRequest } from "./loyalty.ts";
import {
  handlePaymentAttemptRegistrationRequest,
  handlePaymentAttemptRequest,
  handlePaymentAttemptRecoveryRequest,
  type PaymentAttemptEnv,
} from "./payment-attempts.ts";
import { handleCmsPageRequest } from "./cms.ts";
import {
  handleStorefrontHomeRequest,
  handleStorefrontMetadataRequest,
} from "./storefront-public.ts";
import { handleNavigationRequest } from "./navigation.ts";
import { handleAnnouncementRequest } from "./announcement.ts";
import { handleBlogRequest } from "./blog.ts";
import { handleCategoryRequest } from "./category.ts";
import { handleSitemapRequest, handleSitemapXmlRequest } from "./sitemap.ts";
import {
  handleCmsAdminPageMutationsRequest,
  handleCmsAdminPageRequest,
} from "./cms-admin.ts";
import { handleCmsAdminNavigationRequest } from "./navigation-admin.ts";
import { handleCmsAdminAnnouncementRequest } from "./announcement-admin.ts";
import {
  handleCmsAdminBlogBulkRequest,
  handleCmsAdminBlogExportRequest,
  handleCmsAdminBlogRequest,
} from "./blog-admin.ts";
import {
  handleCmsAdminFormSubmissionsExportRequest,
  handleCmsAdminFormSubmissionsRequest,
} from "./forms-admin.ts";
import {
  handleCmsAdminCategoryGapsRequest,
  handleCmsAdminCategoryRequest,
  handleCmsAdminCategorySyncRequest,
} from "./category-admin.ts";
import { handleAdminBlockPresetsRequest } from "./block-presets-admin.ts";
import { handleAdminCmsFormSettingsRequest } from "./form-settings-admin.ts";
import { handleAdminCmsExperimentsRequest } from "./cms-experiments-admin.ts";
import { handleAdminCmsComponentsRequest } from "./cms-components-admin.ts";
import { handleAdminCmsRedirectsRequest } from "./cms-redirects-admin.ts";
import { handleAdminDeliveryOperationsRequest } from "./delivery-operations-admin.ts";
import { handleAdminPosEnterpriseRequest } from "./pos-enterprise-admin.ts";
import { handleAdminStorefrontHomeRequest } from "./storefront-home-admin.ts";
import { handleAdminPosShiftsRequest } from "./pos-shifts-admin.ts";
import { handleAdminPaymentMarkReviewRequest } from "./payment-mark-review-admin.ts";
import { handleAdminPaymentRetryRequest } from "./payment-retry-admin.ts";
import { handleAdminWorkflowEntitiesRequest } from "./workflow-admin.ts";
import { handleAdminWorkflowTransitionRequest } from "./workflow-transition-admin.ts";
import { handleAdminVoidsRequest } from "./voids-admin.ts";
import { handleAdminReconciliationRequest } from "./reconciliation-admin.ts";
import { handleAdminPinApprovalRequest } from "./pin-approval-admin.ts";
import { handleAdminTrackingCapabilityRevokeRequest } from "./tracking-capability-revoke-admin.ts";
import { handleCourierTelemetryRequest } from "./courier-telemetry.ts";
import { handleAdminTerminalOpenDrawerRequest } from "./terminal-open-drawer-admin.ts";
import {
  handleCmsAdminMediaDetailRequest,
  handleCmsAdminMediaDeleteRequest,
  handleCmsAdminMediaListRequest,
  handleCmsAdminMediaUploadRequest,
} from "./media-admin.ts";
import { handleNativeOrderFinalizationRequest } from "./order-finalization.ts";
import { handleComplianceRequest } from "./compliance.ts";
import { handleWishlistRequest } from "./wishlist.ts";
import {
  handleOrderCancellationRequest,
  handleOrderReturnRequest,
} from "./order-mutations.ts";
import { handleAdminRefundRequest } from "./admin-refund.ts";
import { handleAdminOrderStatusRequest } from "./admin-order-status.ts";
import { handlePaymentHealthRequest } from "./payment-health.ts";
import { handlePaymentAttemptsExportRequest } from "./payment-export-admin.ts";
import { handleAuditLogsRequest } from "./audit-admin.ts";
import { handlePaymentRecoveryMetricsRequest } from "./payment-recovery-admin.ts";
import { handleInventoryLedgerRequest } from "./inventory-ledger-admin.ts";
import { handleAdminReviewsRequest } from "./reviews-admin.ts";
import { handleAdminOperatorNotesRequest } from "./operator-notes-admin.ts";
import { handleAdminCrmNotesRequest } from "./crm-notes-admin.ts";
import { handleAdminCrmOperationsRequest } from "./crm-operations-admin.ts";
import { handleAdminCrmBridgeRequest } from "./crm-bridge-admin.ts";
import { handleAdminRolesRequest } from "./roles-admin.ts";
import { handleAdminTasksTodayRequest } from "./tasks-admin.ts";
import { handleAdminIntegrationHealthRequest } from "./integration-health-admin.ts";
import { handleAdminPancakeIntegrationRequest } from "./pancake-admin.ts";
import {
  handleAdminLoyaltyLookupRequest,
  handleAdminLoyaltyRequest,
  handleAdminLoyaltyPointsRequest,
  handleAdminLoyaltyRewardsRequest,
} from "./loyalty-admin.ts";
import { handleAdminPaymentsRequest } from "./payments-admin.ts";
import { handleAdminPaymentCapabilitiesRequest } from "./payment-capabilities-admin.ts";
import { handleAdminProfileRequest } from "./profile-admin.ts";
import { handleAdminStorefrontMetadataRequest } from "./storefront-metadata-admin.ts";
import { handleAdminRuntimeSettingsRequest } from "./runtime-settings-admin.ts";
import { handleAdminOfflineQueueRequest } from "./offline-queue-admin.ts";
import { handleAdminDevicesRequest } from "./devices-admin.ts";
import {
  handleAdminSegmentsRequest,
  handleAdminSegmentMembersRequest,
} from "./segments-admin.ts";
import {
  handleAdminEmployeesRequest,
  handleAdminEmployeePinRequest,
} from "./employees-admin.ts";
import { handleAdminCampaignsRequest } from "./campaigns-admin.ts";
import { handlePaymentMethodsRequest } from "./payment-methods.ts";
import { handleDeliveryShipmentsRequest } from "./delivery-admin.ts";
import {
  handleInvoiceCreateRequest,
  handleInvoiceLifecycleRequest,
  handleInvoiceListRequest,
} from "./invoice-admin.ts";
import { handleAdminReceiptRequest } from "./receipt-admin.ts";
import {
  handleChatOrderIntake,
  handleChatOrderList,
  handleChatOrderStatus,
} from "./chat-orders-admin.ts";
import { handlePayPalConfirmationRequest } from "./paypal-confirm.ts";
import {
  handleAdminCatalogCategoriesRequest,
  handleAdminCatalogProductsRequest,
  handleAdminCatalogProductRequest,
  handleAdminCatalogProductDeleteRequest,
  handleAdminCustomersRequest,
  handleAdminInventoryRequest,
  handleAdminOrdersRequest,
  handleAdminOrderDetailRequest,
} from "./admin-commerce.ts";
import { handleAdminCatalogProductMutationRequest } from "./catalog-admin.ts";
import { handleAdminAnalyticsRequest } from "./analytics-admin.ts";
import { handleCatalogProviderSyncRequest } from "./catalog-provider-sync.ts";
import { deleteCatalogProductWithProviderArchive } from "./catalog-delete-saga.ts";
import { handleNangoAdminRequest } from "./nango-admin.ts";
import { handleNangoWebhook } from "./nango-webhook.ts";
import {
  handleChannelEventListRequest,
  handleChannelEventProcessRequest,
  handleChannelWebhookRequest,
} from "./channel-events-admin.ts";
import { handleInventoryAdjustmentRequest } from "./inventory-admin.ts";
import {
  handleInventoryReservationCollectionRequest,
  handleInventoryReservationMutationRequest,
} from "./inventory-reservations-admin.ts";
import {
  handleInventoryCycleCountCollectionRequest,
  handleInventoryCycleCountDetailRequest,
  handleInventoryCycleCountMutationRequest,
} from "./inventory-cycle-counts-admin.ts";
import {
  handleInventoryPurchaseOrderCollectionRequest,
  handleInventoryPurchaseOrderDetailRequest,
  handleInventoryPurchaseOrderMutationRequest,
} from "./inventory-purchase-orders-admin.ts";
import {
  handleInventoryTransferCollectionRequest,
  handleInventoryTransferDetailRequest,
  handleInventoryTransferMutationRequest,
} from "./inventory-transfers-admin.ts";
import { handleBulkFulfillmentRequest } from "./fulfillment-admin.ts";
import { handlePosDraftRequest, handlePosSaleRequest } from "./pos-admin.ts";
import { handleTrackingRequest } from "./tracking.ts";
import {
  handleAdminPromotionCodesRequest,
  handlePromotionRequest,
} from "./promotions.ts";
import {
  handleReviewCreateRequest,
  handleReviewListRequest,
} from "./reviews.ts";
import { handleReviewMutationRequest } from "./review-mutations.ts";
import { handleReceiptUploadRequest } from "./receipt-upload.ts";
import { handleCartAbandonmentRequest } from "./cart-abandonment.ts";
import {
  handleBackInStockRequest,
  handleNewsletterConfirmRequest,
  handleNewsletterRequest,
  handleNewsletterUnsubscribeRequest,
} from "./public-marketing.ts";
import type { WorkerQueue } from "./queue.ts";
import { handleWorkerCronRequest } from "./cron.ts";

export interface BackendEnv
  extends CheckoutEnv, WorkerWebhookEnv, OrderReadEnv, PaymentAttemptEnv {
  ALLOWED_ORIGINS?: string;
  CMS_ORGANIZATION_ID?: string;
  DEFAULT_ORGANIZATION_ID?: string;
  PUBLIC_SITE_URL?: string;
  JWT_SECRET?: string;
  CMS_ADMIN_JWT_SECRET?: string;
  AUTH_SECRET?: string;
  SUPABASE_URL?: string;
  NANGO_API_KEY?: string;
  PANCAKE_POS_API_KEY?: string;
  PANCAKE_POS_API_URL?: string;
  NANGO_WEBHOOK_SIGNING_KEY?: string;
  NANGO_PAYMENT_INTEGRATIONS?: string;
  NANGO_CRM_INTEGRATIONS?: string;
  CHANNEL_WEBHOOK_SECRET?: string;
  CHANNEL_TENANT_KEY?: string;
  CHANNEL_ALLOWED_IDS?: string;
  UVS_MERCHANT_COUNTRY?: string;
  APP_HYPERDRIVE?: { connectionString: string };
  MEDUSA_HYPERDRIVE?: { connectionString: string };
  APP_DB_URL?: string;
  COURIER_TELEMETRY_SECRET?: string;
  CRON_SECRET?: string;
  TERMINAL_AGENT_URL?: string;
  TERMINAL_AGENT_SECRET?: string;
  ADMIN_STEP_UP_REQUIRED?: string;
  ADMIN_STEP_UP_SECRET?: string;
  TERMINAL_DEVICE_BINDING_REQUIRED?: string;
  MEDUSA_DB_URL?: string;
  COMMERCE_QUEUE?: WorkerQueue;
  [key: string]: unknown;
}

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function allowedOrigin(request: Request, env: BackendEnv): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

function requestId(request: Request): string {
  return request.headers.get("X-Request-ID")?.trim() || crypto.randomUUID();
}

function jsonError(error: string, id: string, status: number): Response {
  return new Response(JSON.stringify({ error, requestId: id }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Request-ID": id,
    },
  });
}

function nativeRouteFailureCode(error: unknown): string {
  const candidate =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  return typeof candidate === "string" ? candidate : "UNKNOWN";
}

export function nativeRouteFailureResponse(error: unknown, id: string): Response {
  // PostgreSQL's undefined-table error means the deployed Worker schema is
  // behind the database it is connected to. Reporting that as a catalog outage
  // sends operators toward the wrong recovery path and hides the real defect.
  if (nativeRouteFailureCode(error) === "42P01") {
    return jsonError("database_schema_unavailable", id, 503);
  }
  return jsonError("catalog_unavailable", id, 503);
}

function logNativeRouteFailure(
  error: unknown,
  requestId: string,
  matches: Record<string, unknown>,
): void {
  const candidate = nativeRouteFailureCode(error);
  const errorCode =
    /^[0-9A-Z]{5}$/.test(candidate)
      ? candidate
      : "UNKNOWN";
  const route =
    Object.entries(matches).find(([, match]) => Boolean(match))?.[0] ??
    "unknown";
  console.error(
    JSON.stringify({
      event: "worker_native_route_failed",
      requestId,
      route,
      databaseRole: nativeDatabaseRole(matches),
      errorCode,
    }),
  );
}

function responseHeaders(source: Headers, origin: string | null): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set("Cache-Control", "no-store");
  headers.set("Referrer-Policy", "no-referrer");
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.append("Vary", "Origin");
  }
  return headers;
}

function hasConfiguredDatabase(env: BackendEnv): boolean {
  return Boolean(
    env.APP_HYPERDRIVE?.connectionString ||
    env.MEDUSA_HYPERDRIVE?.connectionString ||
    env.APP_DB_URL ||
    env.MEDUSA_DB_URL,
  );
}

function hasConfiguredDatabaseForRole(
  env: BackendEnv,
  role: WorkerDatabaseRole,
): boolean {
  if (role === "app") {
    return Boolean(env.APP_HYPERDRIVE?.connectionString || env.APP_DB_URL);
  }
  return Boolean(env.MEDUSA_HYPERDRIVE?.connectionString || env.MEDUSA_DB_URL);
}

export async function probeWorkerDatabaseRoles(
  env: BackendEnv,
  probe: (role: WorkerDatabaseRole) => Promise<boolean> = async (_role) => {
    if (!hasConfiguredDatabaseForRole(env, _role)) return false;
    try {
      return await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        async (database) => {
          const result = await database.query<{ ok: number | string }>(
            "SELECT 1 AS ok",
          );
          return Number(result.rows[0]?.ok) === 1;
        },
        _role,
      );
    } catch {
      return false;
    }
  },
): Promise<Record<WorkerDatabaseRole, boolean>> {
  const [app, medusa] = await Promise.all([probe("app"), probe("medusa")]);
  return { app, medusa };
}

export function nativeDatabaseRole(
  matches: Record<string, unknown>,
): WorkerDatabaseRole {
  const appRouteKeys = [
    "cmsPageMatch",
    "navigationMatch",
    "storefrontHomeMatch",
    "storefrontMetadataMatch",
    "announcementMatch",
    "blogListMatch",
    "blogPostMatch",
    "categoriesMatch",
    "categoryMatch",
    "sitemapMatch",
    "sitemapXmlMatch",
    "cmsAdminCreateMatch",
    "cmsAdminPageListMatch",
    "cmsAdminPageDetailMatch",
    "cmsAdminPageMutationsMatch",
    "cmsAdminUpdateMatch",
    "cmsAdminNavigationMatch",
    "cmsAdminNavigationPublishMatch",
    "cmsAdminAnnouncementMatch",
    "cmsAdminBlogMatch",
    "cmsAdminBlogBulkMatch",
    "cmsAdminBlogExportMatch",
    "cmsAdminFormSubmissionsExportMatch",
    "cmsAdminFormSubmissionsMatch",
    "cmsAdminBlogDetailMatch",
    "cmsAdminCategoryMatch",
    "cmsAdminCategorySyncMatch",
    "cmsAdminCategoryGapsMatch",
    "cmsAdminBlockPresetsMatch",
    "cmsAdminBlockPresetDetailMatch",
    "cmsAdminFormSettingsMatch",
    "cmsAdminExperimentsMatch",
    "cmsAdminExperimentCreateMatch",
    "cmsAdminExperimentDetailMatch",
    "cmsAdminComponentsMatch",
    "cmsAdminComponentDetailMatch",
    "cmsAdminRedirectsMatch",
    "cmsAdminRedirectDetailMatch",
    "cmsAdminRedirectBulkMatch",
    "cmsAdminRedirectExportMatch",
    "cmsAdminRedirectImportMatch",
    "cmsAdminRedirectResolveMatch",
    "adminDeliveryOperationsMatch",
    "adminPosEnterpriseMatch",
    "adminStorefrontHomeMatch",
    "adminPosShiftsMatch",
    "adminPosShiftCloseMatch",
    "adminPosShiftReconciliationMatch",
    "adminPaymentMarkReviewMatch",
    "adminPaymentRetryMatch",
    "adminWorkflowEntitiesMatch",
    "adminWorkflowTransitionMatch",
    "adminVoidsMatch",
    "adminReconciliationMatch",
    "adminPinApprovalMatch",
    "adminCrmNotesMatch",
    "adminCrmNoteDetailMatch",
    "adminCrmOperationsMatch",
    "adminCrmBridgeMatch",
    "adminLoyaltyMatch",
    "adminLoyaltyPointsMatch",
    "adminLoyaltyRewardsMatch",
    "cmsAdminMediaListMatch",
    "cmsAdminMediaDetailMatch",
    "customerProfileMatch",
    "customerMarketingPreferencesMatch",
    "customerOrderPreferencesMatch",
    "customerLoyaltyMatch",
    "paymentHealthMatch",
    "paymentAttemptMatch",
    "paymentAttemptRegistrationMatch",
    "paymentAttemptRecoveryMatch",
    "nangoAdminMatch",
    "nangoWebhookMatch",
    "channelWebhookMatch",
    "channelEventListMatch",
    "channelEventProcessMatch",
    "webhookMatch",
    "newsletterMatch",
    "newsletterConfirmMatch",
    "newsletterUnsubscribeMatch",
    "reviewListMatch",
    "reviewCreateMatch",
    "reviewMutationMatch",
    "adminReceiptsMatch",
    "adminInventoryReservationMatch",
    "adminInventoryReservationCollectionMatch",
    "adminInventoryCycleCountCollectionMatch",
    "adminInventoryCycleCountDetailMatch",
    "adminInventoryCycleCountMutationMatch",
    "adminInventoryPurchaseOrderCollectionMatch",
    "adminInventoryPurchaseOrderDetailMatch",
    "adminInventoryPurchaseOrderMutationMatch",
    "adminInventoryTransferCollectionMatch",
    "adminInventoryTransferDetailMatch",
    "adminInventoryTransferMutationMatch",
    "adminSegmentsMatch",
    "adminSegmentMembersMatch",
    "adminEmployeesMatch",
    "adminEmployeeDetailMatch",
    "adminEmployeePinMatch",
    "adminCampaignsMatch",
    "adminCampaignDetailMatch",
    "adminCampaignExecuteMatch",
    "adminPancakeIntegrationMatch",
    "bulkFulfillmentMatch",
  ];
  return appRouteKeys.some((key) => Boolean(matches[key])) ? "app" : "medusa";
}

export async function handleBackendRequest(
  request: Request,
  configuredEnv: BackendEnv,
): Promise<Response> {
  const canonicalAdminSecret = configuredEnv.JWT_SECRET?.trim();
  const env: BackendEnv = canonicalAdminSecret
    ? { ...configuredEnv, CMS_ADMIN_JWT_SECRET: canonicalAdminSecret }
    : configuredEnv;
  const id = requestId(request);
  const origin = allowedOrigin(request, env);

  const path = new URL(request.url).pathname;
  if (path.startsWith("/internal/cron/")) {
    const response = await handleWorkerCronRequest(request, env);
    const headers = responseHeaders(response.headers, origin);
    headers.set("X-Request-ID", id);
    return new Response(response.body, { status: response.status, headers });
  }
  if (
    request.method === "GET" &&
    (path === "/health" || path === "/healthz" || path === "/readyz")
  ) {
    const databaseRoles =
      path === "/readyz" ? await probeWorkerDatabaseRoles(env) : null;
    const ready =
      path === "/health" ||
      path === "/healthz" ||
      Boolean(databaseRoles?.app && databaseRoles.medusa);
    const body = JSON.stringify({
      status: ready ? "ok" : "not_ready",
      runtime: "cloudflare_worker",
      database: hasConfiguredDatabase(env),
      ...(databaseRoles ? { databaseRoles } : {}),
      requestId: id,
    });
    const headers = new Headers({
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "X-Request-ID": id,
    });
    if (origin) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Credentials", "true");
      headers.append("Vary", "Origin");
    }
    return new Response(body, { status: ready ? 200 : 503, headers });
  }

  const productMatch =
    request.method === "GET"
      ? path.match(/^\/store\/products\/([^/]+)$/)
      : null;
  const regionsMatch = request.method === "GET" && path === "/store/regions";
  const collectionsMatch =
    request.method === "GET" && path === "/store/collections";
  const catalogCategoriesMatch =
    request.method === "GET" && path === "/store/catalog/categories";
  const searchSuggestionsMatch =
    request.method === "GET" && path === "/store/search/suggestions";
  const socialProofMatch =
    request.method === "GET" && path === "/store/social-proof";
  const collectionMatch =
    request.method === "GET"
      ? path.match(/^\/store\/collections\/([^/]+)$/)
      : null;
  const cartMatch =
    request.method === "GET" ? path.match(/^\/store\/carts\/([^/]+)$/) : null;
  const cartCreateMatch = request.method === "POST" && path === "/store/carts";
  const cartUpdateMatch =
    (request.method === "PUT" || request.method === "PATCH") &&
    path.match(/^\/store\/carts\/([^/]+)$/);
  const cartLineMatch =
    request.method === "PUT" || request.method === "PATCH"
      ? path.match(/^\/store\/carts\/([^/]+)\/line-items\/([^/]+)$/)
      : null;
  const cartAddMatch =
    request.method === "POST"
      ? path.match(/^\/store\/carts\/([^/]+)\/line-items$/)
      : null;
  const cartReconcileMatch =
    request.method === "POST" && path === "/store/cart/reconcile";
  const cartMergeMatch = request.method === "POST" && path === "/store/cart/merge";
  const checkoutMatch =
    request.method === "POST" && path === "/store/checkout/session";
  const checkoutPreviewMatch =
    request.method === "POST" && path === "/store/checkout/preview";
  const paymentAttemptRegistrationMatch =
    request.method === "POST" && path === "/store/checkout-intents";
  const paymentAttemptRecoveryMatch =
    request.method === "GET" && path === "/store/checkout-intents/recover";
  const promotionMatch =
    ["POST", "DELETE"].includes(request.method) &&
    path === "/store/carts/promotion";
  const adminPromotionCodesMatch =
    request.method === "GET" && path === "/api/admin/promotions/codes";
  const newsletterMatch =
    request.method === "POST" && path === "/store/newsletter";
  const newsletterConfirmMatch =
    request.method === "GET" && path === "/store/newsletter/confirm";
  const newsletterUnsubscribeMatch =
    request.method === "POST" && path === "/store/newsletter/unsubscribe";
  const backInStockMatch =
    request.method === "POST" && path === "/store/back-in-stock";
  const reviewListMatch = request.method === "GET" && path === "/store/reviews";
  const reviewCreateMatch =
    request.method === "POST" && path === "/store/reviews";
  const reviewMutationMatch =
    request.method === "POST" &&
    path.match(/^\/store\/reviews\/([^/]+)\/(helpful|report)$/);
  const receiptUploadMatch =
    request.method === "POST" &&
    path === "/store/checkout/upload-payment-receipt";
  const cartAbandonmentMatch =
    request.method === "POST" && path === "/store/cart/abandonment";
  const paypalConfirmMatch =
    request.method === "POST" && path === "/store/checkout/paypal/confirm";
  const webhookMatch =
    request.method === "POST"
      ? path.match(/^\/webhooks\/(stripe|paypal|xendit|pancake)$/)
      : null;
  const nangoWebhookMatch =
    request.method === "POST" && path === "/api/webhooks/nango";
  const channelWebhookMatch =
    request.method === "POST" && path === "/api/integrations/channels/webhook";
  const courierTelemetryMatch =
    request.method === "POST" &&
    path === "/api/integrations/couriers/telemetry";
  const channelEventListMatch =
    request.method === "GET" && path === "/api/admin/channels/events";
  const channelEventProcessMatch =
    request.method === "POST"
      ? path.match(/^\/api\/admin\/channels\/events\/([^/]+)\/process$/)
      : null;
  const customerOrdersMatch =
    request.method === "GET" && path === "/store/customers/me/orders";
  const customerOrderDetailMatch =
    request.method === "GET"
      ? path.match(/^\/store\/customers\/me\/orders\/([^/]+)$/)
      : null;
  const trackingMatch =
    request.method === "GET" ? path.match(/^\/store\/tracking\/(.+)$/) : null;
  const customerOrderCancelMatch =
    request.method === "POST"
      ? path.match(/^\/store\/customers\/me\/orders\/([^/]+)\/cancel$/)
      : null;
  const orderReturnMatch =
    request.method === "POST" && path === "/store/orders/return";
  const adminRefundMatch =
    request.method === "POST"
      ? path.match(/^\/(?:api\/)?admin\/orders\/([^/]+)\/refund$/)
      : null;
  const adminOrdersMatch =
    request.method === "GET" &&
    (path === "/api/admin/orders" || path === "/admin/orders");
  const adminAnalyticsMatch =
    request.method === "GET"
      ? path.match(
          /^\/(?:api\/)?admin\/analytics\/(?:clv|retention|sales-trends)$/,
        )
      : null;
  const adminOrderDetailMatch =
    request.method === "GET"
      ? path.match(/^\/(?:api\/)?admin\/orders\/([^/]+)$/)
      : null;
  const adminOrderStatusMatch =
    request.method === "PATCH"
      ? path.match(/^\/api\/admin\/orders\/([^/]+)\/status$/)
      : null;
  const adminInventoryMatch =
    (request.method === "GET" || request.method === "POST") &&
    (path === "/api/admin/inventory" || path === "/admin/inventory");
  const adminInventoryReservationMatch =
    request.method === "POST"
      ? path.match(/^\/api\/admin\/inventory\/reservations\/([^/]+)$/)
      : null;
  const adminInventoryReservationCollectionMatch =
    ["GET", "POST"].includes(request.method) &&
    path === "/api/admin/inventory/reservations";
  const adminInventoryCycleCountCollectionMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/api/admin/inventory/cycle-counts" ||
      path === "/admin/inventory/cycle-counts");
  const adminInventoryCycleCountDetailMatch =
    request.method === "GET"
      ? path.match(/^\/(?:api\/)?admin\/inventory\/cycle-counts\/([^/]+)$/)
      : null;
  const adminInventoryCycleCountMutationMatch =
    request.method === "POST"
      ? path.match(/^\/(?:api\/)?admin\/inventory\/cycle-counts\/([^/]+)$/)
      : null;
  const adminInventoryPurchaseOrderCollectionMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/api/admin/inventory/purchase-orders" ||
      path === "/admin/inventory/purchase-orders");
  const adminInventoryPurchaseOrderDetailMatch =
    request.method === "GET"
      ? path.match(/^\/(?:api\/)?admin\/inventory\/purchase-orders\/([^/]+)$/)
      : null;
  const adminInventoryPurchaseOrderMutationMatch =
    request.method === "POST"
      ? path.match(/^\/(?:api\/)?admin\/inventory\/purchase-orders\/([^/]+)$/)
      : null;
  const adminInventoryTransferCollectionMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/api/admin/inventory/transfers" ||
      path === "/admin/inventory/transfers");
  const adminInventoryTransferDetailMatch =
    request.method === "GET"
      ? path.match(/^\/(?:api\/)?admin\/inventory\/transfers\/([^/]+)$/)
      : null;
  const adminInventoryTransferMutationMatch =
    request.method === "POST"
      ? path.match(/^\/(?:api\/)?admin\/inventory\/transfers\/([^/]+)$/)
      : null;
  const adminCatalogProductsMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/api/admin/catalog/products" ||
      path === "/admin/catalog/products");
  const adminCatalogCategoriesMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/api/admin/catalog/categories" ||
      path === "/admin/catalog/categories");
  const adminCatalogProductMatch = ["GET", "PATCH", "DELETE"].includes(
    request.method,
  )
    ? path.match(/^\/(?:api\/)?admin\/catalog\/products\/([^/]+)$/)
    : null;
  const catalogProviderSyncMatch =
    ["POST", "DELETE"].includes(request.method) &&
    path === "/api/admin/catalog/provider-sync";
  const nangoAdminMatch = [
    "/api/admin/payments/connections",
    "/api/admin/payments/connections/reconnect",
    "/api/admin/payments/connect-session",
    "/api/admin/crm/nango",
    "/api/admin/crm/nango/connect-session",
  ].includes(path);
  const posDraftMatch =
    request.method === "POST" && path === "/api/admin/pos/draft-order";
  const posSaleMatch =
    request.method === "POST" && path === "/api/admin/pos/sales";
  const bulkFulfillmentMatch =
    request.method === "POST" && path === "/api/admin/orders/bulk-fulfill";
  const adminCustomersMatch =
    request.method === "GET"
      ? path.match(/^\/(?:api\/)?admin\/customers(?:\/([^/]+))?$/)
      : null;
  const paymentHealthMatch =
    request.method === "GET" &&
    (path === "/api/admin/payment-health" || path === "/admin/payment-health");
  const paymentAttemptsExportMatch =
    request.method === "GET" &&
    (path === "/api/admin/payment-attempts/export" ||
      path === "/admin/payment-attempts/export");
  const auditLogsMatch =
    request.method === "GET" &&
    (path === "/api/admin/audit-logs" || path === "/admin/audit-logs");
  const paymentRecoveryMetricsMatch =
    request.method === "GET" &&
    (path === "/api/admin/commerce-recovery-metrics" ||
      path === "/admin/commerce-recovery-metrics");
  const inventoryLedgerMatch =
    request.method === "GET" &&
    (path === "/api/admin/inventory/ledger" ||
      path === "/admin/inventory/ledger");
  const adminReviewsMatch =
    (request.method === "GET" &&
      (path === "/api/admin/reviews" || path === "/admin/reviews")) ||
    (request.method === "PATCH" &&
      path.match(/^\/api\/admin\/reviews\/([^/]+)$/));
  const adminOperatorNotesMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/api/admin/operator-notes" || path === "/admin/operator-notes");
  const adminCrmNotesMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/api/admin/crm/notes" || path === "/admin/crm/notes");
  const adminCrmNoteDetailMatch =
    request.method === "DELETE"
      ? path.match(/^\/(?:api\/)?admin\/crm\/notes\/([^/]+)$/)
      : null;
  const adminCrmOperationsMatch =
    ["GET", "POST", "PATCH", "DELETE"].includes(request.method) &&
    (path === "/api/admin/crm/operations" || path === "/admin/crm/operations");
  const adminCrmBridgeMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/api/admin/crm/bridge" || path === "/admin/crm/bridge");
  const adminRolesMatch =
    request.method === "GET" &&
    (path === "/api/admin/roles" || path === "/admin/roles");
  const adminTasksTodayMatch =
    request.method === "GET" &&
    (path === "/api/admin/tasks/today" || path === "/admin/tasks/today");
  const adminIntegrationHealthMatch =
    request.method === "GET" &&
    (path === "/api/admin/integration-health" ||
      path === "/admin/integration-health");
  const adminPancakeIntegrationMatch =
    request.method === "GET" && path === "/api/admin/integrations/pancake";
  const adminLoyaltyLookupMatch =
    request.method === "GET" &&
    (path === "/api/admin/loyalty/lookup" || path === "/admin/loyalty/lookup");
  const adminLoyaltyMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/api/admin/loyalty" || path === "/admin/loyalty");
  const adminLoyaltyPointsMatch =
    request.method === "POST" &&
    (path === "/api/admin/loyalty/points" || path === "/admin/loyalty/points");
  const adminLoyaltyRewardsMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/api/admin/loyalty/rewards" ||
      path === "/admin/loyalty/rewards");
  const adminPaymentsMatch =
    request.method === "GET" &&
    (path === "/api/admin/payments" || path === "/admin/payments");
  const adminPaymentCapabilitiesMatch =
    request.method === "GET" &&
    (path === "/api/admin/payments/capabilities" ||
      path === "/admin/payments/capabilities");
  const adminProfileMatch =
    request.method === "PATCH" &&
    (path === "/api/admin/profile" || path === "/admin/profile");
  const adminStorefrontMetadataMatch =
    ["GET", "PUT"].includes(request.method) &&
    (path === "/api/admin/storefront-public-metadata" ||
      path === "/admin/storefront-public-metadata");
  const adminRuntimeSettingsMatch =
    ["GET", "PUT"].includes(request.method) &&
    (path === "/api/admin/runtime-settings" ||
      path === "/admin/runtime-settings");
  const adminOfflineQueueMatch =
    ["GET", "POST", "PATCH"].includes(request.method) &&
    (path === "/api/admin/offline-queue" || path === "/admin/offline-queue");
  const adminDevicesMatch =
    (request.method === "GET" || request.method === "POST") &&
    (path === "/api/admin/devices" || path === "/admin/devices");
  const adminDeviceDetailMatch =
    request.method === "PATCH"
      ? path.match(/^\/api\/admin\/devices\/([^/]+)$/)
      : null;
  const adminSegmentsMatch =
    (request.method === "GET" &&
      (path === "/api/admin/segments" || path === "/admin/segments")) ||
    (request.method === "POST" &&
      (path === "/api/admin/segments" || path === "/admin/segments"));
  const adminSegmentMembersMatch = ["GET", "POST"].includes(request.method)
    ? path.match(/^\/(?:api\/)?admin\/segments\/([^/]+)\/members$/)
    : null;
  const adminEmployeesMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/api/admin/employees" || path === "/admin/employees");
  const adminEmployeeDetailMatch = ["GET", "PATCH", "DELETE"].includes(
    request.method,
  )
    ? path.match(/^\/(?:api\/)?admin\/employees\/([^/]+)$/)
    : null;
  const adminEmployeePinMatch = ["POST", "PUT"].includes(request.method)
    ? path.match(/^\/(?:api\/)?admin\/employees\/([^/]+)\/pin$/)
    : null;
  const adminCampaignsMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/api/admin/campaigns" || path === "/admin/campaigns");
  const adminCampaignDetailMatch = ["GET", "PATCH"].includes(request.method)
    ? path.match(/^\/(?:api\/)?admin\/campaigns\/([^/]+)$/)
    : null;
  const adminCampaignExecuteMatch =
    request.method === "POST"
      ? path.match(/^\/(?:api\/)?admin\/campaigns\/([^/]+)\/execute$/)
      : null;
  const paymentMethodsMatch =
    request.method === "GET" && path === "/store/payment-methods";
  const deliveryShipmentsMatch =
    (request.method === "GET" || request.method === "POST") &&
    (path === "/api/admin/delivery-logistics/shipments" ||
      path === "/admin/delivery-logistics/shipments");
  const invoiceListMatch =
    request.method === "GET" &&
    (path === "/api/admin/invoices" || path === "/admin/invoices");
  const invoiceCreateMatch =
    request.method === "POST" &&
    (path === "/api/admin/invoices" || path === "/admin/invoices");
  const invoiceLifecycleMatch =
    request.method === "POST"
      ? path.match(/^\/(?:api\/)?admin\/invoices\/([^/]+)\/lifecycle$/)
      : null;
  const adminReceiptsMatch =
    (request.method === "GET" || request.method === "POST") &&
    path === "/api/admin/receipts";
  const chatOrderListMatch =
    request.method === "GET" && path === "/api/admin/chat-orders";
  const chatOrderIntakeMatch =
    request.method === "POST" &&
    path === "/api/integrations/chat-orders/intake";
  const chatOrderStatusMatch =
    request.method === "POST"
      ? path.match(/^\/api\/admin\/chat-orders\/([^/]+)\/status$/)
      : null;
  const customerReceiptMatch =
    request.method === "GET"
      ? path.match(/^\/store\/customers\/me\/orders\/([^/]+)\/receipt$/)
      : null;
  const customerProfileMatch =
    (request.method === "GET" || request.method === "PUT") &&
    path === "/store/customers/me";
  const customerMarketingPreferencesMatch =
    (request.method === "GET" || request.method === "PATCH") &&
    path === "/store/customers/me/marketing-preferences";
  const customerOrderPreferencesMatch =
    (request.method === "GET" || request.method === "PATCH") &&
    path === "/store/customers/me/order-preferences";
  const customerLoyaltyMatch =
    request.method === "GET" && path === "/store/customers/me/loyalty";
  const paymentAttemptMatch =
    request.method === "GET"
      ? path.match(/^\/store\/checkout-intents\/(?!recover$)([^/]+)$/)
      : null;
  const paymentFinalizationMatch =
    request.method === "POST"
      ? path.match(/^\/store\/checkout-intents\/([^/]+)\/finalize$/)
      : null;
  const inventoryMatch =
    request.method === "GET"
      ? path.match(/^\/store\/inventory\/([^/]+)$/)
      : null;
  const cmsPageMatch =
    request.method === "GET" ? path.match(/^\/store\/pages\/([^/]+)$/) : null;
  const cmsAdminCreateMatch =
    request.method === "POST" &&
    (path === "/admin/cms/pages" || path === "/api/admin/cms/pages");
  const cmsAdminPageListMatch =
    request.method === "GET" &&
    (path === "/admin/cms/pages" || path === "/api/admin/cms/pages");
  const cmsAdminUpdateMatch =
    request.method === "PUT" || request.method === "PATCH"
      ? path.match(/^\/(?:api\/)?admin\/cms\/pages\/([^/]+)$/)
      : null;
  const cmsAdminPageDetailMatch = ["GET", "DELETE"].includes(request.method)
    ? path.match(/^\/(?:api\/)?admin\/cms\/pages\/([^/]+)$/)
    : null;
  const cmsAdminPageMutationsMatch =
    request.method === "GET"
      ? path.match(/^\/(?:api\/)?admin\/cms\/pages\/([^/]+)\/mutations$/)
      : null;
  const cmsAdminNavigationMatch =
    (request.method === "GET" || request.method === "PUT") &&
    (path === "/admin/cms/navigation" || path === "/api/admin/cms/navigation");
  const cmsAdminNavigationPublishMatch =
    request.method === "POST" &&
    (path === "/admin/cms/navigation/publish" ||
      path === "/api/admin/cms/navigation/publish");
  const cmsAdminAnnouncementMatch =
    ["GET", "PUT", "DELETE"].includes(request.method) &&
    (path === "/admin/cms/announcement" ||
      path === "/api/admin/cms/announcement");
  const cmsAdminBlogMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/admin/cms/blog" || path === "/api/admin/cms/blog");
  const cmsAdminBlogBulkMatch =
    request.method === "POST" &&
    (path === "/admin/cms/blog/bulk" || path === "/api/admin/cms/blog/bulk");
  const cmsAdminBlogExportMatch =
    request.method === "GET" &&
    (path === "/admin/cms/blog/export" ||
      path === "/api/admin/cms/blog/export");
  const cmsAdminFormSubmissionsExportMatch =
    request.method === "GET" &&
    (path === "/admin/cms/forms/submissions/export" ||
      path === "/api/admin/cms/forms/submissions/export");
  const cmsAdminFormSubmissionsMatch =
    (request.method === "GET" &&
      (path === "/admin/cms/forms/submissions" ||
        path === "/api/admin/cms/forms/submissions")) ||
    (request.method === "PATCH"
      ? path.match(/^\/(?:api\/)?admin\/cms\/forms\/submissions\/([^/]+)$/)
      : null);
  const cmsAdminBlogDetailMatch = ["GET", "PUT", "DELETE"].includes(
    request.method,
  )
    ? path.match(/^\/(?:api\/)?admin\/cms\/blog\/([^/]+)$/)
    : null;
  const cmsAdminCategoryMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/admin/cms/category-content" ||
      path === "/api/admin/cms/category-content");
  const cmsAdminCategorySyncMatch =
    request.method === "POST" &&
    path === "/api/admin/cms/category-content/sync-from-catalog";
  const cmsAdminCategoryGapsMatch =
    request.method === "GET" &&
    path === "/api/admin/cms/category-content/catalog-gaps";
  const cmsAdminBlockPresetsMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/admin/cms/block-presets" ||
      path === "/api/admin/cms/block-presets");
  const cmsAdminBlockPresetDetailMatch =
    request.method === "DELETE"
      ? path.match(/^\/(?:api\/)?admin\/cms\/block-presets\/([^/]+)$/)
      : null;
  const cmsAdminFormSettingsMatch =
    ["GET", "PUT"].includes(request.method) &&
    (path === "/admin/cms/forms/settings" ||
      path === "/api/admin/cms/forms/settings");
  const cmsAdminExperimentsMatch =
    request.method === "GET" &&
    (path === "/admin/cms/experiments" ||
      path === "/api/admin/cms/experiments");
  const cmsAdminExperimentCreateMatch =
    request.method === "POST" &&
    (path === "/admin/cms/experiments" ||
      path === "/api/admin/cms/experiments");
  const cmsAdminExperimentDetailMatch =
    request.method === "PUT"
      ? path.match(/^\/(?:api\/)?admin\/cms\/experiments\/([^/]+)$/)
      : null;
  const cmsAdminComponentsMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/admin/cms/components" || path === "/api/admin/cms/components");
  const cmsAdminComponentDetailMatch = [
    "GET",
    "PATCH",
    "POST",
    "DELETE",
  ].includes(request.method)
    ? path.match(/^\/(?:api\/)?admin\/cms\/components\/([^/]+)$/)
    : null;
  const cmsAdminRedirectsMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/admin/cms/redirects" || path === "/api/admin/cms/redirects");
  const cmsAdminRedirectDetailMatch = ["PUT", "DELETE"].includes(request.method)
    ? path.match(/^\/(?:api\/)?admin\/cms\/redirects\/([^/]+)$/)
    : null;
  const cmsAdminRedirectBulkMatch =
    request.method === "PATCH" &&
    (path === "/admin/cms/redirects/bulk" ||
      path === "/api/admin/cms/redirects/bulk");
  const cmsAdminRedirectExportMatch =
    request.method === "GET" &&
    (path === "/admin/cms/redirects/export" ||
      path === "/api/admin/cms/redirects/export");
  const cmsAdminRedirectImportMatch =
    request.method === "POST" &&
    (path === "/admin/cms/redirects/import" ||
      path === "/api/admin/cms/redirects/import");
  const cmsAdminRedirectResolveMatch =
    request.method === "GET" &&
    (path === "/admin/cms/redirects/resolve" ||
      path === "/api/admin/cms/redirects/resolve");
  const adminDeliveryOperationsMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/admin/delivery-logistics/operations" ||
      path === "/api/admin/delivery-logistics/operations");
  const adminPosEnterpriseMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/admin/pos/enterprise" || path === "/api/admin/pos/enterprise");
  const adminStorefrontHomeMatch =
    ["GET", "PUT"].includes(request.method) &&
    (path === "/admin/storefront-home" ||
      path === "/api/admin/storefront-home");
  const adminPosShiftsMatch =
    ["GET", "POST"].includes(request.method) &&
    (path === "/admin/shifts" || path === "/api/admin/shifts");
  const adminPosShiftCloseMatch =
    request.method === "POST"
      ? path.match(/^\/(?:api\/)?admin\/shifts\/([^/]+)\/close$/)
      : null;
  const adminPosShiftReconciliationMatch =
    request.method === "GET"
      ? path.match(/^\/(?:api\/)?admin\/shifts\/([^/]+)\/reconciliation$/)
      : null;
  const adminPaymentMarkReviewMatch =
    request.method === "POST"
      ? path.match(/^\/(?:api\/)?admin\/payments\/([^/]+)\/mark-review$/)
      : null;
  const adminPaymentRetryMatch =
    request.method === "POST"
      ? path.match(/^\/(?:api\/)?admin\/payments\/([^/]+)\/retry$/)
      : null;
  const adminWorkflowEntitiesMatch =
    request.method === "GET" &&
    /^\/(?:api\/)?admin\/workflow\/entities$/.test(path)
      ? true
      : null;
  const adminWorkflowTransitionMatch =
    request.method === "POST" &&
    /^\/(?:api\/)?admin\/workflow\/transition$/.test(path)
      ? true
      : null;
  const adminVoidsMatch =
    (request.method === "GET" || request.method === "POST") &&
    /^\/(?:api\/)?admin\/voids$/.test(path)
      ? true
      : null;
  const adminReconciliationMatch =
    request.method === "GET" && /^\/(?:api\/)?admin\/reconciliation$/.test(path)
      ? true
      : null;
  const adminPinApprovalMatch =
    request.method === "POST" && /^\/(?:api\/)?admin\/pin-approval$/.test(path)
      ? true
      : null;
  const adminTrackingCapabilityRevokeMatch =
    request.method === "POST" &&
    /^\/(?:api\/)?admin\/tracking-capabilities\/revoke$/.test(path)
      ? true
      : null;
  const adminTerminalOpenDrawerMatch =
    request.method === "POST" &&
    /^\/(?:api\/)?admin\/terminal-open-drawer$/.test(path)
      ? true
      : null;
  const cmsAdminMediaListMatch =
    request.method === "GET" &&
    (path === "/admin/cms/media" ||
      path === "/api/admin/cms/media" ||
      path === "/admin/catalog/media" ||
      path === "/api/admin/catalog/media");
  const cmsAdminMediaUploadMatch =
    request.method === "POST" &&
    (path === "/admin/catalog/media" ||
      path === "/api/admin/catalog/media" ||
      path === "/admin/cms/media" ||
      path === "/api/admin/cms/media");
  const cmsAdminMediaDetailMatch = ["GET", "PATCH", "DELETE"].includes(
    request.method,
  )
    ? path.match(/^\/(?:api\/)?admin\/cms\/media\/([^/]+)$/)
    : null;
  const navigationMatch =
    request.method === "GET" && path === "/store/navigation";
  const storefrontHomeMatch =
    request.method === "GET" && path === "/storefront/home";
  const storefrontMetadataMatch =
    request.method === "GET" && path === "/storefront/public-metadata";
  const announcementMatch =
    request.method === "GET" && path === "/store/announcements";
  const blogListMatch = request.method === "GET" && path === "/store/blog";
  const blogPostMatch =
    request.method === "GET" ? path.match(/^\/store\/blog\/([^/]+)$/) : null;
  const categoriesMatch =
    request.method === "GET" && path === "/store/categories";
  const categoryMatch =
    request.method === "GET"
      ? path.match(/^\/store\/categories\/([^/]+)$/)
      : null;
  const sitemapMatch = request.method === "GET" && path === "/store/sitemap";
  const sitemapXmlMatch = request.method === "GET" && path === "/sitemap.xml";
  const complianceExportMatch =
    request.method === "GET" && path === "/compliance/export";
  const complianceErasureMatch =
    request.method === "POST" && path === "/compliance/erasure";
  const complianceRetentionMatch =
    request.method === "POST" &&
    path === "/compliance/retention/anonymize-addresses";
  const wishlistMatch =
    path === "/store/wishlist" &&
    ["GET", "POST", "DELETE"].includes(request.method);
  const wishlistSyncMatch =
    request.method === "POST" && path === "/store/wishlist/sync";
  const nativeRouteMatches = {
    cmsPageMatch,
    navigationMatch,
    storefrontHomeMatch,
    storefrontMetadataMatch,
    announcementMatch,
    blogListMatch,
    blogPostMatch,
    categoriesMatch,
    categoryMatch,
    catalogCategoriesMatch,
    searchSuggestionsMatch,
    socialProofMatch,
    sitemapMatch,
    sitemapXmlMatch,
    cmsAdminCreateMatch,
    cmsAdminPageListMatch,
    cmsAdminPageDetailMatch,
    cmsAdminPageMutationsMatch,
    cmsAdminUpdateMatch,
    cmsAdminNavigationMatch,
    cmsAdminNavigationPublishMatch,
    cmsAdminAnnouncementMatch,
    cmsAdminBlogMatch,
    cmsAdminBlogBulkMatch,
    cmsAdminBlogExportMatch,
    cmsAdminFormSubmissionsExportMatch,
    cmsAdminFormSubmissionsMatch,
    cmsAdminBlogDetailMatch,
    cmsAdminCategoryMatch,
    cmsAdminCategorySyncMatch,
    cmsAdminCategoryGapsMatch,
    cmsAdminBlockPresetsMatch,
    cmsAdminBlockPresetDetailMatch,
    cmsAdminFormSettingsMatch,
    cmsAdminExperimentsMatch,
    cmsAdminExperimentCreateMatch,
    cmsAdminExperimentDetailMatch: Boolean(cmsAdminExperimentDetailMatch),
    cmsAdminComponentsMatch,
    cmsAdminComponentDetailMatch: Boolean(cmsAdminComponentDetailMatch),
    cmsAdminRedirectsMatch,
    cmsAdminRedirectDetailMatch: Boolean(cmsAdminRedirectDetailMatch),
    cmsAdminRedirectBulkMatch,
    cmsAdminRedirectExportMatch,
    cmsAdminRedirectImportMatch,
    cmsAdminRedirectResolveMatch,
    adminDeliveryOperationsMatch,
    adminPosEnterpriseMatch,
    adminStorefrontHomeMatch,
    adminPosShiftsMatch,
    adminPosShiftCloseMatch,
    adminPosShiftReconciliationMatch,
    adminPaymentMarkReviewMatch,
    adminPaymentRetryMatch,
    adminWorkflowEntitiesMatch,
    adminWorkflowTransitionMatch,
    adminVoidsMatch,
    adminReconciliationMatch,
    adminPinApprovalMatch,
    adminCrmNotesMatch,
    adminCrmNoteDetailMatch: Boolean(adminCrmNoteDetailMatch),
    adminCrmOperationsMatch,
    adminCrmBridgeMatch,
    adminLoyaltyMatch,
    adminLoyaltyPointsMatch,
    adminLoyaltyRewardsMatch,
    cmsAdminMediaListMatch,
    cmsAdminMediaDetailMatch,
    cmsAdminMediaUploadMatch,
    paymentHealthMatch,
    paymentAttemptsExportMatch,
    auditLogsMatch,
    paymentRecoveryMetricsMatch,
    inventoryLedgerMatch,
    adminReviewsMatch,
    adminRolesMatch,
    adminTasksTodayMatch,
    adminIntegrationHealthMatch,
    adminPancakeIntegrationMatch,
    adminLoyaltyLookupMatch,
    adminPaymentsMatch,
    adminPaymentCapabilitiesMatch,
    adminProfileMatch,
    adminStorefrontMetadataMatch,
    adminRuntimeSettingsMatch,
    adminOfflineQueueMatch,
    adminDevicesMatch,
    adminDeviceDetailMatch: Boolean(adminDeviceDetailMatch),
    adminSegmentsMatch,
    adminSegmentMembersMatch,
    adminEmployeesMatch,
    adminEmployeeDetailMatch,
    adminEmployeePinMatch,
    adminCampaignsMatch,
    adminCampaignDetailMatch,
    adminCampaignExecuteMatch,
    nangoAdminMatch,
    nangoWebhookMatch,
    channelWebhookMatch,
    courierTelemetryMatch,
    channelEventListMatch,
    channelEventProcessMatch,
    adminOrdersMatch,
    adminOrderDetailMatch,
    adminInventoryMatch,
    bulkFulfillmentMatch,
    adminInventoryReservationMatch,
    adminInventoryReservationCollectionMatch,
    adminInventoryCycleCountCollectionMatch,
    adminInventoryCycleCountDetailMatch: Boolean(
      adminInventoryCycleCountDetailMatch,
    ),
    adminInventoryCycleCountMutationMatch: Boolean(
      adminInventoryCycleCountMutationMatch,
    ),
    adminInventoryPurchaseOrderCollectionMatch,
    adminInventoryPurchaseOrderDetailMatch: Boolean(
      adminInventoryPurchaseOrderDetailMatch,
    ),
    adminInventoryPurchaseOrderMutationMatch: Boolean(
      adminInventoryPurchaseOrderMutationMatch,
    ),
    adminInventoryTransferCollectionMatch,
    adminInventoryTransferDetailMatch: Boolean(
      adminInventoryTransferDetailMatch,
    ),
    adminInventoryTransferMutationMatch: Boolean(
      adminInventoryTransferMutationMatch,
    ),
    adminCatalogProductsMatch,
    adminCatalogProductMatch,
    adminCustomersMatch,
    paymentMethodsMatch,
    newsletterMatch,
    newsletterConfirmMatch,
    newsletterUnsubscribeMatch,
    backInStockMatch,
    reviewListMatch,
    reviewCreateMatch,
    reviewMutationMatch: Boolean(reviewMutationMatch),
    receiptUploadMatch,
    cartAbandonmentMatch,
    invoiceListMatch,
    invoiceCreateMatch,
    invoiceLifecycleMatch,
    adminReceiptsMatch,
    customerProfileMatch,
    customerMarketingPreferencesMatch,
    customerOrderPreferencesMatch,
    customerLoyaltyMatch,
    paymentAttemptRegistrationMatch,
    paymentAttemptRecoveryMatch,
    webhookMatch,
    paypalConfirmMatch,
    trackingMatch,
    promotionMatch,
  };
  const complianceNativeMatch =
    complianceExportMatch || complianceErasureMatch || complianceRetentionMatch;
  const appOnlyNativeMatch =
    Object.values(nativeRouteMatches).some(Boolean) ||
    Boolean(
      cmsAdminMediaUploadMatch ||
      cmsAdminMediaDetailMatch ||
      paymentAttemptMatch ||
      paymentAttemptRegistrationMatch ||
      paymentAttemptRecoveryMatch ||
      adminTrackingCapabilityRevokeMatch ||
      adminTerminalOpenDrawerMatch,
    );
  const crossDatabaseNativeMatch = Boolean(
    complianceNativeMatch ||
    bulkFulfillmentMatch ||
    customerOrderCancelMatch ||
    orderReturnMatch ||
    adminRefundMatch ||
    adminOrderStatusMatch ||
    cmsAdminCategorySyncMatch ||
    cmsAdminCategoryGapsMatch ||
    (adminInventoryReservationCollectionMatch && request.method === "POST") ||
    (adminInventoryCycleCountCollectionMatch && request.method === "POST") ||
    adminInventoryCycleCountMutationMatch ||
    (adminInventoryPurchaseOrderCollectionMatch && request.method === "POST") ||
    adminInventoryPurchaseOrderMutationMatch ||
    (adminInventoryTransferCollectionMatch && request.method === "POST") ||
    adminInventoryTransferMutationMatch ||
    adminOrderDetailMatch ||
    (deliveryShipmentsMatch && request.method === "POST") ||
    invoiceCreateMatch ||
    adminReceiptsMatch ||
    checkoutMatch ||
    paymentAttemptRegistrationMatch ||
    paypalConfirmMatch ||
    paymentFinalizationMatch ||
    wishlistMatch ||
    wishlistSyncMatch ||
    (cmsAdminMediaDetailMatch &&
      (request.method === "DELETE" ||
        new URL(request.url).searchParams.get("refs") === "1")) ||
    backInStockMatch ||
    reviewMutationMatch ||
    receiptUploadMatch ||
    cartAbandonmentMatch ||
    reviewCreateMatch,
  );
  const splitDatabaseMisconfiguration =
    hasConfiguredDatabase(env) &&
    ((appOnlyNativeMatch && !hasConfiguredDatabaseForRole(env, "app")) ||
      (crossDatabaseNativeMatch &&
        (!hasConfiguredDatabaseForRole(env, "app") ||
          !hasConfiguredDatabaseForRole(env, "medusa"))));
  if (splitDatabaseMisconfiguration) {
    return jsonError("database_not_configured", id, 503);
  }
  if (webhookMatch) {
    try {
      const queuedResponse = await enqueueWorkerWebhookRequest(
        request,
        webhookMatch[1] as "stripe" | "paypal" | "xendit" | "pancake",
        env,
      );
      const headers = responseHeaders(queuedResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(queuedResponse.body, {
        status: queuedResponse.status,
        headers,
      });
    } catch (error) {
      logNativeRouteFailure(error, id, nativeRouteMatches);
      return jsonError("webhook_unavailable", id, 503);
    }
  }
  if (
    adminPaymentRetryMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handleAdminPaymentRetryRequest(
                request,
                appDatabase,
                commerceDatabase,
                env,
                id,
              ),
            "medusa",
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("payment_retry_unavailable", id, 503);
    }
  }
  if (
    adminWorkflowTransitionMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handleAdminWorkflowTransitionRequest(
                request,
                appDatabase,
                commerceDatabase,
                env,
                id,
              ),
            "medusa",
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("workflow_transition_unavailable", id, 503);
    }
  }
  if (
    adminTrackingCapabilityRevokeMatch &&
    hasConfiguredDatabaseForRole(env, "app")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          handleAdminTrackingCapabilityRevokeRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("tracking_capability_unavailable", id, 503);
    }
  }
  if (
    adminTerminalOpenDrawerMatch &&
    hasConfiguredDatabaseForRole(env, "app")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          handleAdminTerminalOpenDrawerRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("terminal_agent_unavailable", id, 503);
    }
  }
  if (
    complianceNativeMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await handleComplianceRequest(request, env);
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.append("Vary", "Origin");
      }
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("compliance_unavailable", id, 503);
    }
  }
  if (
    (customerOrderCancelMatch || orderReturnMatch) &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = customerOrderCancelMatch
        ? await handleOrderCancellationRequest(
            request,
            env,
            decodeURIComponent(customerOrderCancelMatch[1]),
          )
        : await handleOrderReturnRequest(request, env);
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.append("Vary", "Origin");
      }
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("order_mutation_unavailable", id, 503);
    }
  }
  if (
    adminRefundMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await handleAdminRefundRequest(
        request,
        env,
        decodeURIComponent(adminRefundMatch[1]),
      );
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.append("Vary", "Origin");
      }
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("refund_unavailable", id, 503);
    }
  }
  if (
    adminOrderStatusMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handleAdminOrderStatusRequest(
                request,
                commerceDatabase,
                appDatabase,
                env,
                decodeURIComponent(adminOrderStatusMatch[1]),
              ),
            "medusa",
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("order_status_unavailable", id, 503);
    }
  }
  if (
    cmsAdminCategorySyncMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handleCmsAdminCategorySyncRequest(
                request,
                appDatabase,
                commerceDatabase,
                env,
              ),
            "medusa",
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("cms_category_sync_unavailable", id, 503);
    }
  }
  if (
    cmsAdminCategoryGapsMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handleCmsAdminCategoryGapsRequest(
                request,
                appDatabase,
                commerceDatabase,
                env,
              ),
            "medusa",
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("cms_category_gaps_unavailable", id, 503);
    }
  }
  if (
    adminInventoryReservationCollectionMatch &&
    hasConfiguredDatabaseForRole(env, "app")
  ) {
    try {
      const nativeResponse =
        request.method === "POST" && hasConfiguredDatabaseForRole(env, "medusa")
          ? await withWorkerDatabase(
              env as BackendEnv & WorkerDatabaseEnv,
              (appDatabase) =>
                withWorkerDatabase(
                  env as BackendEnv & WorkerDatabaseEnv,
                  (commerceDatabase) =>
                    handleInventoryReservationCollectionRequest(
                      request,
                      appDatabase,
                      commerceDatabase,
                      env,
                    ),
                  "medusa",
                ),
              "app",
            )
          : await withWorkerDatabase(
              env as BackendEnv & WorkerDatabaseEnv,
              (appDatabase) =>
                handleInventoryReservationCollectionRequest(
                  request,
                  appDatabase,
                  undefined,
                  env,
                ),
              "app",
            );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("inventory_reservations_unavailable", id, 503);
    }
  }
  if (
    adminInventoryCycleCountCollectionMatch &&
    hasConfiguredDatabaseForRole(env, "app")
  ) {
    try {
      const nativeResponse =
        request.method === "POST" && hasConfiguredDatabaseForRole(env, "medusa")
          ? await withWorkerDatabase(
              env as BackendEnv & WorkerDatabaseEnv,
              (appDatabase) =>
                withWorkerDatabase(
                  env as BackendEnv & WorkerDatabaseEnv,
                  (commerceDatabase) =>
                    handleInventoryCycleCountCollectionRequest(
                      request,
                      appDatabase,
                      commerceDatabase,
                      env,
                    ),
                  "medusa",
                ),
              "app",
            )
          : await withWorkerDatabase(
              env as BackendEnv & WorkerDatabaseEnv,
              (appDatabase) =>
                handleInventoryCycleCountCollectionRequest(
                  request,
                  appDatabase,
                  undefined,
                  env,
                ),
              "app",
            );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("inventory_cycle_counts_unavailable", id, 503);
    }
  }
  if (
    adminInventoryCycleCountDetailMatch &&
    hasConfiguredDatabaseForRole(env, "app")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          handleInventoryCycleCountDetailRequest(
            request,
            appDatabase,
            env,
            decodeURIComponent(adminInventoryCycleCountDetailMatch[1]),
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("inventory_cycle_count_unavailable", id, 503);
    }
  }
  if (
    adminInventoryCycleCountMutationMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handleInventoryCycleCountMutationRequest(
                request,
                appDatabase,
                commerceDatabase,
                env,
                decodeURIComponent(adminInventoryCycleCountMutationMatch[1]),
              ),
            "medusa",
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("inventory_cycle_count_unavailable", id, 503);
    }
  }
  if (
    adminInventoryPurchaseOrderCollectionMatch &&
    hasConfiguredDatabaseForRole(env, "app")
  ) {
    try {
      const nativeResponse =
        request.method === "POST" && hasConfiguredDatabaseForRole(env, "medusa")
          ? await withWorkerDatabase(
              env as BackendEnv & WorkerDatabaseEnv,
              (appDatabase) =>
                withWorkerDatabase(
                  env as BackendEnv & WorkerDatabaseEnv,
                  (commerceDatabase) =>
                    handleInventoryPurchaseOrderCollectionRequest(
                      request,
                      appDatabase,
                      commerceDatabase,
                      env,
                    ),
                  "medusa",
                ),
              "app",
            )
          : await withWorkerDatabase(
              env as BackendEnv & WorkerDatabaseEnv,
              (appDatabase) =>
                handleInventoryPurchaseOrderCollectionRequest(
                  request,
                  appDatabase,
                  undefined,
                  env,
                ),
              "app",
            );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("inventory_purchase_orders_unavailable", id, 503);
    }
  }
  if (
    adminInventoryPurchaseOrderDetailMatch &&
    hasConfiguredDatabaseForRole(env, "app")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          handleInventoryPurchaseOrderDetailRequest(
            request,
            appDatabase,
            env,
            decodeURIComponent(adminInventoryPurchaseOrderDetailMatch[1]),
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("inventory_purchase_order_unavailable", id, 503);
    }
  }
  if (
    adminInventoryPurchaseOrderMutationMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handleInventoryPurchaseOrderMutationRequest(
                request,
                appDatabase,
                commerceDatabase,
                env,
                decodeURIComponent(adminInventoryPurchaseOrderMutationMatch[1]),
              ),
            "medusa",
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("inventory_purchase_order_unavailable", id, 503);
    }
  }
  if (
    adminInventoryTransferCollectionMatch &&
    hasConfiguredDatabaseForRole(env, "app")
  ) {
    try {
      const nativeResponse =
        request.method === "POST" && hasConfiguredDatabaseForRole(env, "medusa")
          ? await withWorkerDatabase(
              env as BackendEnv & WorkerDatabaseEnv,
              (appDatabase) =>
                withWorkerDatabase(
                  env as BackendEnv & WorkerDatabaseEnv,
                  (commerceDatabase) =>
                    handleInventoryTransferCollectionRequest(
                      request,
                      appDatabase,
                      commerceDatabase,
                      env,
                    ),
                  "medusa",
                ),
              "app",
            )
          : await withWorkerDatabase(
              env as BackendEnv & WorkerDatabaseEnv,
              (appDatabase) =>
                handleInventoryTransferCollectionRequest(
                  request,
                  appDatabase,
                  undefined,
                  env,
                ),
              "app",
            );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("inventory_transfers_unavailable", id, 503);
    }
  }
  if (
    adminInventoryTransferDetailMatch &&
    hasConfiguredDatabaseForRole(env, "app")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          handleInventoryTransferDetailRequest(
            request,
            appDatabase,
            env,
            decodeURIComponent(adminInventoryTransferDetailMatch[1]),
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("inventory_transfer_unavailable", id, 503);
    }
  }
  if (
    adminInventoryTransferMutationMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handleInventoryTransferMutationRequest(
                request,
                appDatabase,
                commerceDatabase,
                env,
                decodeURIComponent(adminInventoryTransferMutationMatch[1]),
              ),
            "medusa",
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("inventory_transfer_unavailable", id, 503);
    }
  }
  if (
    adminInventoryReservationMatch &&
    hasConfiguredDatabaseForRole(env, "app")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          handleInventoryReservationMutationRequest(
            request,
            database,
            env,
            decodeURIComponent(adminInventoryReservationMatch[1]),
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("inventory_reservation_unavailable", id, 503);
    }
  }
  if (paymentHealthMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handlePaymentHealthRequest(request, database, env),
        "app",
      );
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.append("Vary", "Origin");
      }
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("payment_health_unavailable", id, 503);
    }
  }
  if (paymentAttemptsExportMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          handlePaymentAttemptsExportRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("payment_attempts_export_unavailable", id, 503);
    }
  }
  if (auditLogsMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleAuditLogsRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("audit_logs_unavailable", id, 503);
    }
  }
  if (paymentRecoveryMetricsMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          handlePaymentRecoveryMetricsRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("payment_recovery_metrics_unavailable", id, 503);
    }
  }
  if (inventoryLedgerMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleInventoryLedgerRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("inventory_ledger_unavailable", id, 503);
    }
  }
  if (adminReviewsMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const reviewId =
        typeof adminReviewsMatch === "object"
          ? decodeURIComponent(adminReviewsMatch[1])
          : undefined;
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          handleAdminReviewsRequest(request, database, { ...env, reviewId }),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("reviews_unavailable", id, 503);
    }
  }
  if (adminOperatorNotesMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleAdminOperatorNotesRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("operator_notes_unavailable", id, 503);
    }
  }
  if (
    (adminCrmNotesMatch || adminCrmNoteDetailMatch) &&
    hasConfiguredDatabaseForRole(env, "app")
  ) {
    try {
      const noteId = adminCrmNoteDetailMatch
        ? decodeURIComponent(adminCrmNoteDetailMatch[1])
        : undefined;
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          handleAdminCrmNotesRequest(request, database, env, noteId),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("crm_notes_unavailable", id, 503);
    }
  }
  if (adminCrmOperationsMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleAdminCrmOperationsRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("crm_operations_unavailable", id, 503);
    }
  }
  if (adminCrmBridgeMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleAdminCrmBridgeRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("crm_bridge_unavailable", id, 503);
    }
  }
  if (adminRolesMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleAdminRolesRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("roles_unavailable", id, 503);
    }
  }
  if (adminTasksTodayMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleAdminTasksTodayRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("tasks_today_unavailable", id, 503);
    }
  }
  if (adminIntegrationHealthMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          handleAdminIntegrationHealthRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("integration_health_unavailable", id, 503);
    }
  }
  if (
    adminPancakeIntegrationMatch &&
    hasConfiguredDatabaseForRole(env, "app")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          handleAdminPancakeIntegrationRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("pancake_integration_unavailable", id, 503);
    }
  }
  if (adminLoyaltyLookupMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleAdminLoyaltyLookupRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("loyalty_lookup_unavailable", id, 503);
    }
  }
  if (adminLoyaltyMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleAdminLoyaltyRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("loyalty_unavailable", id, 503);
    }
  }
  if (adminLoyaltyPointsMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleAdminLoyaltyPointsRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("loyalty_points_unavailable", id, 503);
    }
  }
  if (adminLoyaltyRewardsMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleAdminLoyaltyRewardsRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("loyalty_rewards_unavailable", id, 503);
    }
  }
  if (adminPaymentsMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleAdminPaymentsRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("payments_unavailable", id, 503);
    }
  }
  if (
    adminPaymentCapabilitiesMatch &&
    hasConfiguredDatabaseForRole(env, "app")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          handleAdminPaymentCapabilitiesRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("payment_capabilities_unavailable", id, 503);
    }
  }
  if (adminProfileMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleAdminProfileRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("profile_unavailable", id, 503);
    }
  }
  if (
    adminStorefrontMetadataMatch &&
    hasConfiguredDatabaseForRole(env, "app")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          handleAdminStorefrontMetadataRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("storefront_metadata_unavailable", id, 503);
    }
  }
  if (adminRuntimeSettingsMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleAdminRuntimeSettingsRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("runtime_settings_unavailable", id, 503);
    }
  }
  if (adminOfflineQueueMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleAdminOfflineQueueRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("offline_queue_unavailable", id, 503);
    }
  }
  if (
    (adminDevicesMatch || adminDeviceDetailMatch) &&
    hasConfiguredDatabaseForRole(env, "app")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          handleAdminDevicesRequest(
            request,
            database,
            env,
            adminDeviceDetailMatch?.[1],
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("devices_unavailable", id, 503);
    }
  }
  if (
    (adminSegmentsMatch || adminSegmentMembersMatch) &&
    hasConfiguredDatabaseForRole(env, "app")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          adminSegmentMembersMatch
            ? handleAdminSegmentMembersRequest(
                request,
                database,
                env,
                decodeURIComponent(adminSegmentMembersMatch[1]),
              )
            : handleAdminSegmentsRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("segments_unavailable", id, 503);
    }
  }
  if (
    (adminEmployeesMatch ||
      adminEmployeeDetailMatch ||
      adminEmployeePinMatch) &&
    hasConfiguredDatabaseForRole(env, "app")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          adminEmployeePinMatch
            ? handleAdminEmployeePinRequest(
                request,
                database,
                env,
                decodeURIComponent(adminEmployeePinMatch[1]),
              )
            : handleAdminEmployeesRequest(
                request,
                database,
                env,
                adminEmployeeDetailMatch?.[1],
              ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("employees_unavailable", id, 503);
    }
  }
  if (
    (adminCampaignsMatch ||
      adminCampaignDetailMatch ||
      adminCampaignExecuteMatch) &&
    hasConfiguredDatabaseForRole(env, "app") &&
    (!adminCampaignExecuteMatch || hasConfiguredDatabaseForRole(env, "medusa"))
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) => {
          const run = (commerceDatabase?: WorkerDatabaseClient) =>
            handleAdminCampaignsRequest(
              request,
              appDatabase,
              commerceDatabase,
              env,
              adminCampaignExecuteMatch?.[1] ?? adminCampaignDetailMatch?.[1],
              Boolean(adminCampaignExecuteMatch),
            );
          return adminCampaignExecuteMatch
            ? withWorkerDatabase(
                env as BackendEnv & WorkerDatabaseEnv,
                run,
                "medusa",
              )
            : run();
        },
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("campaigns_unavailable", id, 503);
    }
  }
  if (nangoAdminMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const kind = path.includes("/crm/") ? "crm" : "payment";
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleNangoAdminRequest(request, database, env, kind),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("provider_connections_unavailable", id, 503);
    }
  }
  if (nangoWebhookMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleNangoWebhook(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("nango_webhook_unavailable", id, 503);
    }
  }
  if (
    channelWebhookMatch ||
    channelEventListMatch ||
    channelEventProcessMatch
  ) {
    if (!hasConfiguredDatabaseForRole(env, "app"))
      return jsonError("database_not_configured", id, 503);
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          channelWebhookMatch
            ? handleChannelWebhookRequest(request, database, env)
            : channelEventListMatch
              ? handleChannelEventListRequest(request, database, env)
              : handleChannelEventProcessRequest(
                  request,
                  database,
                  env,
                  decodeURIComponent(channelEventProcessMatch![1]),
                ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("channel_events_unavailable", id, 503);
    }
  }
  if (courierTelemetryMatch) {
    if (!hasConfiguredDatabaseForRole(env, "app"))
      return jsonError("database_not_configured", id, 503);
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleCourierTelemetryRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("courier_telemetry_unavailable", id, 503);
    }
  }
  if (posDraftMatch && hasConfiguredDatabaseForRole(env, "medusa")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (commerceDatabase) =>
          handlePosDraftRequest(request, commerceDatabase, env),
        "medusa",
      );
      return nativeResponse;
    } catch {
      return jsonError("pos_draft_unavailable", id, 503);
    }
  }
  if (
    bulkFulfillmentMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handleBulkFulfillmentRequest(
                request,
                commerceDatabase,
                appDatabase,
                env,
              ),
            "medusa",
          ),
        "app",
      );
      return nativeResponse;
    } catch {
      return jsonError("bulk_fulfillment_unavailable", id, 503);
    }
  }
  if (
    bulkFulfillmentMatch &&
    (!hasConfiguredDatabaseForRole(env, "app") ||
      !hasConfiguredDatabaseForRole(env, "medusa"))
  ) {
    return jsonError("database_not_configured", id, 503);
  }
  if (
    posSaleMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handlePosSaleRequest(request, appDatabase, commerceDatabase, env),
            "medusa",
          ),
        "app",
      );
      return nativeResponse;
    } catch {
      return jsonError("pos_sale_unavailable", id, 503);
    }
  }
  if (
    catalogProviderSyncMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handleCatalogProviderSyncRequest(
                request,
                appDatabase,
                env,
                commerceDatabase,
              ),
            "medusa",
          ),
        "app",
      );
      return nativeResponse;
    } catch {
      return jsonError("provider_sync_unavailable", id, 503);
    }
  }
  if (
    ((adminCatalogProductsMatch && request.method === "POST") ||
      (adminCatalogProductMatch && request.method === "PATCH")) &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handleAdminCatalogProductMutationRequest(
                request,
                commerceDatabase,
                env,
                adminCatalogProductMatch
                  ? decodeURIComponent(adminCatalogProductMatch[1])
                  : undefined,
                appDatabase,
              ),
            "medusa",
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch (error) {
      return jsonError("catalog_product_mutation_unavailable", id, 503);
    }
  }
  if (adminCatalogProductMatch && request.method === "DELETE") {
    if (
      !hasConfiguredDatabaseForRole(env, "app") ||
      !hasConfiguredDatabaseForRole(env, "medusa")
    ) {
      return jsonError("catalog_product_delete_unavailable", id, 503);
    }
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              deleteCatalogProductWithProviderArchive(
                request,
                decodeURIComponent(adminCatalogProductMatch[1]),
                {
                  archiveProvider: (archiveRequest) =>
                    handleCatalogProviderSyncRequest(
                      archiveRequest,
                      appDatabase,
                      env,
                      commerceDatabase,
                    ),
                  deleteProduct: (deleteRequest, productId) =>
                    handleAdminCatalogProductDeleteRequest(
                      deleteRequest,
                      commerceDatabase,
                      appDatabase,
                      env,
                      productId,
                    ),
                },
              ),
            "medusa",
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("catalog_product_delete_unavailable", id, 503);
    }
  }
  if (adminCatalogCategoriesMatch && request.method === "POST") {
    if (
      !hasConfiguredDatabaseForRole(env, "app") ||
      !hasConfiguredDatabaseForRole(env, "medusa")
    ) {
      return jsonError("catalog_category_create_unavailable", id, 503);
    }
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handleAdminCatalogCategoriesRequest(
                request,
                commerceDatabase,
                env,
                appDatabase,
              ),
            "medusa",
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("catalog_category_create_unavailable", id, 503);
    }
  }
  if (adminPromotionCodesMatch && hasConfiguredDatabaseForRole(env, "medusa")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleAdminPromotionCodesRequest(request, database, env),
        "medusa",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("promotion_codes_unavailable", id, 503);
    }
  }
  if (
    adminOrderDetailMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handleAdminOrderDetailRequest(
                request,
                commerceDatabase,
                env,
                decodeURIComponent(adminOrderDetailMatch[1]),
                appDatabase,
              ),
            "medusa",
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("admin_order_detail_unavailable", id, 503);
    }
  }
  if (adminAnalyticsMatch && hasConfiguredDatabaseForRole(env, "medusa")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleAdminAnalyticsRequest(request, database, env),
        "medusa",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("admin_analytics_unavailable", id, 503);
    }
  }
  if (
    (adminOrdersMatch ||
      adminInventoryMatch ||
      adminCatalogProductsMatch ||
      (adminCatalogProductMatch && request.method !== "DELETE") ||
      (adminCatalogCategoriesMatch && request.method === "GET") ||
      adminCustomersMatch) &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          adminCatalogCategoriesMatch
            ? handleAdminCatalogCategoriesRequest(request, database, env)
            : adminOrdersMatch
              ? handleAdminOrdersRequest(request, database, env)
              : adminInventoryMatch && request.method === "POST"
                ? handleInventoryAdjustmentRequest(request, database, env)
                : adminInventoryMatch
                  ? handleAdminInventoryRequest(request, database, env)
                  : adminCatalogProductsMatch && request.method === "POST"
                    ? handleAdminCatalogProductMutationRequest(
                        request,
                        database,
                        env,
                      )
                    : adminCatalogProductMatch && request.method === "PATCH"
                      ? handleAdminCatalogProductMutationRequest(
                          request,
                          database,
                          env,
                          decodeURIComponent(adminCatalogProductMatch[1]),
                        )
                      : adminCatalogProductMatch
                        ? handleAdminCatalogProductRequest(
                            request,
                            database,
                            env,
                            decodeURIComponent(adminCatalogProductMatch[1]),
                          )
                        : adminCatalogProductsMatch
                          ? handleAdminCatalogProductsRequest(
                              request,
                              database,
                              env,
                            )
                          : handleAdminCustomersRequest(
                              request,
                              database,
                              env,
                              adminCustomersMatch?.[1]
                                ? decodeURIComponent(adminCustomersMatch[1])
                                : undefined,
                            ),
        "medusa",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch (error) {
      console.error("admin_commerce_unavailable", {
        requestId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      return jsonError("admin_commerce_unavailable", id, 503);
    }
  }
  if (paymentMethodsMatch) {
    const nativeResponse = hasConfiguredDatabaseForRole(env, "app")
      ? await withWorkerDatabase(
          env as BackendEnv & WorkerDatabaseEnv,
          (database) => handlePaymentMethodsRequest(request, env, database),
          "app",
        )
      : await handlePaymentMethodsRequest(request, env);
    const headers = responseHeaders(nativeResponse.headers, origin);
    headers.set("X-Request-ID", id);
    return new Response(nativeResponse.body, {
      status: nativeResponse.status,
      headers,
    });
  }
  if (deliveryShipmentsMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse =
        request.method === "POST"
          ? await withWorkerDatabase(
              env as BackendEnv & WorkerDatabaseEnv,
              (database) =>
                withWorkerDatabase(
                  env as BackendEnv & WorkerDatabaseEnv,
                  (commerce) =>
                    handleDeliveryShipmentsRequest(
                      request,
                      database,
                      env,
                      commerce,
                    ),
                  "medusa",
                ),
              "app",
            )
          : await withWorkerDatabase(
              env as BackendEnv & WorkerDatabaseEnv,
              (database) =>
                handleDeliveryShipmentsRequest(request, database, env),
              "app",
            );
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.append("Vary", "Origin");
      }
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("delivery_unavailable", id, 503);
    }
  }
  if (
    (invoiceListMatch || invoiceLifecycleMatch) &&
    hasConfiguredDatabaseForRole(env, "app")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          invoiceListMatch
            ? handleInvoiceListRequest(request, database, env)
            : handleInvoiceLifecycleRequest(
                request,
                database,
                env,
                decodeURIComponent(invoiceLifecycleMatch![1]),
              ),
        "app",
      );
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.append("Vary", "Origin");
      }
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("invoice_unavailable", id, 503);
    }
  }
  if (
    adminReceiptsMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handleAdminReceiptRequest(
                request,
                appDatabase,
                commerceDatabase,
                env,
              ),
            "medusa",
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("receipt_unavailable", id, 503);
    }
  }
  if (
    (chatOrderListMatch || chatOrderIntakeMatch || chatOrderStatusMatch) &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              chatOrderListMatch
                ? handleChatOrderList(request, appDatabase, env)
                : chatOrderIntakeMatch
                  ? handleChatOrderIntake(
                      request,
                      appDatabase,
                      commerceDatabase,
                      env,
                    )
                  : handleChatOrderStatus(
                      request,
                      appDatabase,
                      commerceDatabase,
                      env,
                      decodeURIComponent(chatOrderStatusMatch![1]),
                    ),
            "medusa",
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("chat_orders_unavailable", id, 503);
    }
  }
  if (cmsAdminMediaUploadMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleCmsAdminMediaUploadRequest(request, database, env),
        "app",
      );
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.append("Vary", "Origin");
      }
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("media_upload_unavailable", id, 503);
    }
  }
  if (cmsAdminMediaDetailMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          request.method !== "DELETE" &&
          new URL(request.url).searchParams.get("refs") !== "1"
            ? handleCmsAdminMediaDetailRequest(
                request,
                appDatabase,
                appDatabase,
                env,
                decodeURIComponent(cmsAdminMediaDetailMatch![1]),
              )
            : withWorkerDatabase(
                env as BackendEnv & WorkerDatabaseEnv,
                (medusaDatabase) =>
                  request.method === "DELETE"
                    ? handleCmsAdminMediaDeleteRequest(
                        request,
                        appDatabase,
                        medusaDatabase,
                        env,
                        decodeURIComponent(cmsAdminMediaDetailMatch![1]),
                      )
                    : handleCmsAdminMediaDetailRequest(
                        request,
                        appDatabase,
                        medusaDatabase,
                        env,
                        decodeURIComponent(cmsAdminMediaDetailMatch![1]),
                      ),
                "medusa",
              ),
        "app",
      );
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.append("Vary", "Origin");
      }
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("media_delete_unavailable", id, 503);
    }
  }
  if (
    invoiceCreateMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (medusaDatabase) =>
              handleInvoiceCreateRequest(
                request,
                appDatabase,
                medusaDatabase,
                env,
              ),
            "medusa",
          ),
        "app",
      );
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.append("Vary", "Origin");
      }
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("invoice_create_unavailable", id, 503);
    }
  }
  if (
    checkoutMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handleCheckoutSessionRequest(
                request,
                commerceDatabase,
                env,
                appDatabase,
              ),
            "medusa",
          ),
        "app",
      );
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.append("Vary", "Origin");
      }
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("checkout_unavailable", id, 503);
    }
  }
  if (
    paymentAttemptRegistrationMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handlePaymentAttemptRegistrationRequest(
                request,
                appDatabase,
                commerceDatabase,
                env,
              ),
            "medusa",
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("payment_attempt_registration_unavailable", id, 503);
    }
  }
  if (checkoutPreviewMatch && hasConfiguredDatabaseForRole(env, "medusa")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleCheckoutPreviewRequest(request, database),
        "medusa",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("checkout_preview_unavailable", id, 503);
    }
  }
  if (promotionMatch && hasConfiguredDatabaseForRole(env, "medusa")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handlePromotionRequest(request, database),
        "medusa",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("promotion_unavailable", id, 503);
    }
  }
  if (
    (newsletterMatch || newsletterConfirmMatch || newsletterUnsubscribeMatch) &&
    hasConfiguredDatabaseForRole(env, "app")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          newsletterMatch
            ? handleNewsletterRequest(request, database, env)
            : newsletterConfirmMatch
              ? handleNewsletterConfirmRequest(request, database)
              : handleNewsletterUnsubscribeRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("newsletter_unavailable", id, 503);
    }
  }
  if (
    backInStockMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (medusaDatabase) =>
              handleBackInStockRequest(request, appDatabase, medusaDatabase),
            "medusa",
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("back_in_stock_unavailable", id, 503);
    }
  }
  if (reviewListMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleReviewListRequest(request, database),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("reviews_unavailable", id, 503);
    }
  }
  if (reviewMutationMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          handleReviewMutationRequest(
            request,
            database,
            {
              secret: env.JWT_SECRET,
              supabaseUrl: env.SUPABASE_URL,
              AUTH_SECRET: env.AUTH_SECRET,
            },
            reviewMutationMatch[2] as "helpful" | "report",
            decodeURIComponent(reviewMutationMatch[1]),
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("review_mutation_unavailable", id, 503);
    }
  }
  if (
    receiptUploadMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handleReceiptUploadRequest(
                request,
                appDatabase,
                commerceDatabase,
                env,
              ),
            "medusa",
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("receipt_upload_unavailable", id, 503);
    }
  }
  if (cartAbandonmentMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleCartAbandonmentRequest(request, database, env),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("cart_abandonment_unavailable", id, 503);
    }
  }
  if (
    reviewCreateMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handleReviewCreateRequest(
                request,
                appDatabase,
                commerceDatabase,
                {
                  secret: env.JWT_SECRET,
                  supabaseUrl: env.SUPABASE_URL,
                },
              ),
            "medusa",
          ),
        "app",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("reviews_unavailable", id, 503);
    }
  }
  if (cartMergeMatch) {
    if (!hasConfiguredDatabaseForRole(env, "app") || !hasConfiguredDatabaseForRole(env, "medusa"))
      return jsonError("database_not_configured", id, 503);
    try {
      const nativeResponse = await handleCartMergeRequest(request, env);
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      return new Response(nativeResponse.body, { status: nativeResponse.status, headers });
    } catch {
      return jsonError("cart_merge_unavailable", id, 503);
    }
  }
  if (cartReconcileMatch && hasConfiguredDatabaseForRole(env, "medusa")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handleCartReconcileRequest(request, database),
        "medusa",
      );
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("cart_reconciliation_unavailable", id, 503);
    }
  }
  if (paypalConfirmMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handlePayPalConfirmationRequest(request, database, env),
        "app",
      );
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.append("Vary", "Origin");
      }
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("paypal_confirmation_unavailable", id, 503);
    }
  }
  if (paymentAttemptRecoveryMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handlePaymentAttemptRecoveryRequest(request, database),
        "app",
      );
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.append("Vary", "Origin");
      }
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("payment_attempt_recovery_unavailable", id, 503);
    }
  }
  if (paymentAttemptMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
          handlePaymentAttemptRequest(
            request,
            database,
            decodeURIComponent(paymentAttemptMatch![1]),
            env,
          ),
        "app",
      );
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.append("Vary", "Origin");
      }
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("payment_attempt_unavailable", id, 503);
    }
  }
  if (
    paymentFinalizationMatch &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) =>
          withWorkerDatabase(
            env as BackendEnv & WorkerDatabaseEnv,
            (commerceDatabase) =>
              handleNativeOrderFinalizationRequest(
                request,
                commerceDatabase,
                decodeURIComponent(paymentFinalizationMatch![1]),
                appDatabase,
                env.DEFAULT_ORGANIZATION_ID,
                env,
              ),
            "medusa",
          ),
        "app",
      );
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.append("Vary", "Origin");
      }
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch {
      return jsonError("order_finalization_unavailable", id, 503);
    }
  }
  if (
    (wishlistMatch || wishlistSyncMatch) &&
    hasConfiguredDatabaseForRole(env, "app") &&
    hasConfiguredDatabaseForRole(env, "medusa")
  ) {
    try {
      const nativeResponse = await handleWishlistRequest(
        request,
        env,
        wishlistSyncMatch,
      );
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.append("Vary", "Origin");
      }
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch (error) {
      console.error("wishlist_unavailable", {
        requestId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      return jsonError("wishlist_unavailable", id, 503);
    }
  }
  if (
    ((request.method === "GET" &&
      (path === "/store/products" ||
        regionsMatch ||
        collectionsMatch ||
        catalogCategoriesMatch ||
        searchSuggestionsMatch ||
        collectionMatch ||
        productMatch ||
        cmsPageMatch ||
        navigationMatch ||
        storefrontHomeMatch ||
        storefrontMetadataMatch ||
        announcementMatch ||
        blogListMatch ||
        blogPostMatch ||
        categoriesMatch ||
        categoryMatch ||
        sitemapMatch ||
        sitemapXmlMatch ||
        cartMatch ||
        inventoryMatch ||
        customerOrdersMatch ||
        customerOrderDetailMatch ||
        trackingMatch ||
        customerReceiptMatch)) ||
      customerProfileMatch ||
      customerMarketingPreferencesMatch ||
      customerOrderPreferencesMatch ||
      customerLoyaltyMatch ||
      paymentAttemptMatch ||
      paymentAttemptRecoveryMatch ||
      paymentFinalizationMatch ||
      cartLineMatch ||
      cartAddMatch ||
      cartCreateMatch ||
      cartUpdateMatch ||
      cmsAdminCreateMatch ||
      cmsAdminPageListMatch ||
      cmsAdminPageDetailMatch ||
      cmsAdminPageMutationsMatch ||
      cmsAdminUpdateMatch ||
      cmsAdminNavigationMatch ||
      cmsAdminNavigationPublishMatch ||
      cmsAdminAnnouncementMatch ||
      cmsAdminBlogMatch ||
      cmsAdminBlogBulkMatch ||
      cmsAdminBlogExportMatch ||
      cmsAdminFormSubmissionsExportMatch ||
      cmsAdminFormSubmissionsMatch ||
      cmsAdminBlogDetailMatch ||
      cmsAdminCategoryMatch ||
      cmsAdminBlockPresetsMatch ||
      cmsAdminBlockPresetDetailMatch ||
      cmsAdminFormSettingsMatch ||
      cmsAdminExperimentsMatch ||
      cmsAdminExperimentCreateMatch ||
      cmsAdminExperimentDetailMatch ||
      cmsAdminComponentsMatch ||
      cmsAdminComponentDetailMatch ||
      cmsAdminRedirectsMatch ||
      cmsAdminRedirectDetailMatch ||
      cmsAdminRedirectBulkMatch ||
      cmsAdminRedirectExportMatch ||
      cmsAdminRedirectImportMatch ||
      cmsAdminRedirectResolveMatch ||
      adminDeliveryOperationsMatch ||
      adminPosEnterpriseMatch ||
      adminStorefrontHomeMatch ||
      adminPosShiftsMatch ||
      adminPosShiftCloseMatch ||
      adminPosShiftReconciliationMatch ||
      adminPaymentMarkReviewMatch ||
      adminWorkflowEntitiesMatch ||
      adminVoidsMatch ||
      adminReconciliationMatch ||
      adminPinApprovalMatch ||
      cmsAdminMediaListMatch ||
      socialProofMatch ||
      checkoutMatch ||
      webhookMatch) &&
    hasConfiguredDatabaseForRole(env, nativeDatabaseRole(nativeRouteMatches)) &&
    (!webhookMatch || hasConfiguredDatabaseForRole(env, "app"))
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        async (database) =>
          cmsAdminFormSubmissionsExportMatch
            ? handleCmsAdminFormSubmissionsExportRequest(request, database, env)
            : cmsAdminFormSubmissionsMatch
              ? handleCmsAdminFormSubmissionsRequest(
                  request,
                  database,
                  env,
                  typeof cmsAdminFormSubmissionsMatch === "object"
                    ? decodeURIComponent(cmsAdminFormSubmissionsMatch[1])
                    : undefined,
                )
              : cmsAdminBlogExportMatch
                ? handleCmsAdminBlogExportRequest(request, database, env)
                : cmsAdminBlogBulkMatch
                  ? handleCmsAdminBlogBulkRequest(request, database, env)
                  : cmsAdminBlogMatch
                    ? handleCmsAdminBlogRequest(request, database, env)
                    : cmsAdminBlogDetailMatch
                      ? handleCmsAdminBlogRequest(
                          request,
                          database,
                          env,
                          decodeURIComponent(cmsAdminBlogDetailMatch[1]),
                        )
                      : cmsAdminCategoryMatch
                        ? handleCmsAdminCategoryRequest(request, database, env)
                        : cmsAdminBlockPresetsMatch
                          ? handleAdminBlockPresetsRequest(
                              request,
                              database,
                              env,
                            )
                          : cmsAdminBlockPresetDetailMatch
                            ? handleAdminBlockPresetsRequest(
                                request,
                                database,
                                env,
                                decodeURIComponent(
                                  cmsAdminBlockPresetDetailMatch[1],
                                ),
                              )
                            : cmsAdminFormSettingsMatch
                              ? handleAdminCmsFormSettingsRequest(
                                  request,
                                  database,
                                  env,
                                )
                              : cmsAdminExperimentsMatch ||
                                  cmsAdminExperimentCreateMatch
                                ? handleAdminCmsExperimentsRequest(
                                    request,
                                    database,
                                    env,
                                  )
                                : cmsAdminExperimentDetailMatch
                                  ? handleAdminCmsExperimentsRequest(
                                      request,
                                      database,
                                      env,
                                      decodeURIComponent(
                                        cmsAdminExperimentDetailMatch[1],
                                      ),
                                    )
                                  : cmsAdminComponentsMatch
                                    ? handleAdminCmsComponentsRequest(
                                        request,
                                        database,
                                        env,
                                      )
                                    : cmsAdminComponentDetailMatch
                                      ? handleAdminCmsComponentsRequest(
                                          request,
                                          database,
                                          env,
                                          decodeURIComponent(
                                            cmsAdminComponentDetailMatch[1],
                                          ),
                                        )
                                      : cmsAdminRedirectsMatch ||
                                          cmsAdminRedirectDetailMatch ||
                                          cmsAdminRedirectBulkMatch ||
                                          cmsAdminRedirectExportMatch ||
                                          cmsAdminRedirectImportMatch ||
                                          cmsAdminRedirectResolveMatch
                                        ? handleAdminCmsRedirectsRequest(
                                            request,
                                            database,
                                            env,
                                          )
                                        : adminDeliveryOperationsMatch
                                          ? handleAdminDeliveryOperationsRequest(
                                              request,
                                              database,
                                              env,
                                            )
                                          : adminPosEnterpriseMatch
                                            ? handleAdminPosEnterpriseRequest(
                                                request,
                                                database,
                                                env,
                                              )
                                            : adminStorefrontHomeMatch
                                              ? handleAdminStorefrontHomeRequest(
                                                  request,
                                                  database,
                                                  env,
                                                )
                                              : adminPosShiftsMatch
                                                ? handleAdminPosShiftsRequest(
                                                    request,
                                                    database,
                                                    env,
                                                  )
                                                : adminPosShiftCloseMatch
                                                  ? handleAdminPosShiftsRequest(
                                                      request,
                                                      database,
                                                      env,
                                                      decodeURIComponent(
                                                        adminPosShiftCloseMatch[1],
                                                      ),
                                                      "close",
                                                    )
                                                  : adminPosShiftReconciliationMatch
                                                    ? handleAdminPosShiftsRequest(
                                                        request,
                                                        database,
                                                        env,
                                                        decodeURIComponent(
                                                          adminPosShiftReconciliationMatch[1],
                                                        ),
                                                        "reconciliation",
                                                      )
                                                    : adminPaymentMarkReviewMatch
                                                      ? handleAdminPaymentMarkReviewRequest(
                                                          request,
                                                          database,
                                                          env,
                                                          crypto.randomUUID(),
                                                        )
                                                      : adminWorkflowEntitiesMatch
                                                        ? handleAdminWorkflowEntitiesRequest(
                                                            request,
                                                            database,
                                                            env,
                                                          )
                                                        : adminVoidsMatch
                                                          ? handleAdminVoidsRequest(
                                                              request,
                                                              database,
                                                              env,
                                                            )
                                                          : adminReconciliationMatch
                                                            ? handleAdminReconciliationRequest(
                                                                request,
                                                                database,
                                                                env,
                                                              )
                                                            : adminPinApprovalMatch
                                                              ? handleAdminPinApprovalRequest(
                                                                  request,
                                                                  database,
                                                                  env,
                                                                )
                                                              : cmsAdminMediaListMatch
                                                                ? handleCmsAdminMediaListRequest(
                                                                    request,
                                                                    database,
                                                                    env,
                                                                  )
                                                                : cmsAdminAnnouncementMatch
                                                                  ? handleCmsAdminAnnouncementRequest(
                                                                      request,
                                                                      database,
                                                                      env,
                                                                    )
                                                                  : cmsAdminNavigationMatch
                                                                    ? handleCmsAdminNavigationRequest(
                                                                        request,
                                                                        database,
                                                                        env,
                                                                      )
                                                                    : cmsAdminNavigationPublishMatch
                                                                      ? handleCmsAdminNavigationRequest(
                                                                          request,
                                                                          database,
                                                                          env,
                                                                          true,
                                                                        )
                                                                      : cmsAdminPageMutationsMatch
                                                                        ? handleCmsAdminPageMutationsRequest(
                                                                            request,
                                                                            database,
                                                                            env,
                                                                            decodeURIComponent(
                                                                              cmsAdminPageMutationsMatch[1],
                                                                            ),
                                                                          )
                                                                        : cmsAdminPageDetailMatch
                                                                          ? handleCmsAdminPageRequest(
                                                                              request,
                                                                              database,
                                                                              env,
                                                                              decodeURIComponent(
                                                                                cmsAdminPageDetailMatch[1],
                                                                              ),
                                                                            )
                                                                          : cmsAdminPageListMatch
                                                                            ? handleCmsAdminPageRequest(
                                                                                request,
                                                                                database,
                                                                                env,
                                                                              )
                                                                            : cmsAdminCreateMatch
                                                                              ? handleCmsAdminPageRequest(
                                                                                  request,
                                                                                  database,
                                                                                  env,
                                                                                )
                                                                              : cmsAdminUpdateMatch
                                                                                ? handleCmsAdminPageRequest(
                                                                                    request,
                                                                                    database,
                                                                                    env,
                                                                                    decodeURIComponent(
                                                                                      cmsAdminUpdateMatch[1],
                                                                                    ),
                                                                                  )
                                                                                : socialProofMatch
                                                                                  ? handleSocialProofRequest(
                                                                                      request,
                                                                                      database,
                                                                                    )
                                                                                  : productMatch
                                                                                    ? handleCatalogProductRequest(
                                                                                        request,
                                                                                        database,
                                                                                        decodeURIComponent(
                                                                                          productMatch[1],
                                                                                        ),
                                                                                      )
                                                                                    : regionsMatch
                                                                                      ? handleRegionsRequest(
                                                                                          request,
                                                                                          database,
                                                                                        )
                                                                                      : searchSuggestionsMatch
                                                                                        ? handleCatalogSearchSuggestionsRequest(
                                                                                            request,
                                                                                            database,
                                                                                          )
                                                                                        : collectionsMatch
                                                                                          ? handleCollectionsRequest(
                                                                                              request,
                                                                                              database,
                                                                                            )
                                                                                          : collectionMatch
                                                                                            ? handleCollectionRequest(
                                                                                                request,
                                                                                                database,
                                                                                                decodeURIComponent(
                                                                                                  collectionMatch[1],
                                                                                                ),
                                                                                              )
                                                                                            : cartMatch
                                                                                              ? handleCartRequest(
                                                                                                  request,
                                                                                                  database,
                                                                                                  decodeURIComponent(
                                                                                                    cartMatch[1],
                                                                                                  ),
                                                                                                )
                                                                                              : inventoryMatch
                                                                                                ? handleInventoryAvailabilityRequest(
                                                                                                    request,
                                                                                                    database,
                                                                                                    decodeURIComponent(
                                                                                                      inventoryMatch[1],
                                                                                                    ),
                                                                                                  )
                                                                                                : cartLineMatch
                                                                                                  ? handleCartLineQuantityRequest(
                                                                                                      request,
                                                                                                      database,
                                                                                                      decodeURIComponent(
                                                                                                        cartLineMatch[1],
                                                                                                      ),
                                                                                                      decodeURIComponent(
                                                                                                        cartLineMatch[2],
                                                                                                      ),
                                                                                                    )
                                                                                                  : cartAddMatch
                                                                                                    ? handleAddCartLineRequest(
                                                                                                        request,
                                                                                                        database,
                                                                                                        decodeURIComponent(
                                                                                                          cartAddMatch[1],
                                                                                                        ),
                                                                                                      )
                                                                                                    : cartCreateMatch
                                                                                                      ? handleCreateCartRequest(
                                                                                                          request,
                                                                                                          database,
                                                                                                        )
                                                                                                      : cartUpdateMatch
                                                                                                        ? handleCartUpdateRequest(
                                                                                                            request,
                                                                                                            database,
                                                                                                            decodeURIComponent(
                                                                                                              cartUpdateMatch[1],
                                                                                                            ),
                                                                                                          )
                                                                                                        : checkoutMatch
                                                                                                          ? handleCheckoutSessionRequest(
                                                                                                              request,
                                                                                                              database,
                                                                                                              env,
                                                                                                            )
                                                                                                          : customerOrdersMatch
                                                                                                              ? handleCustomerOrdersRequest(
                                                                                                                  request,
                                                                                                                  database,
                                                                                                                  env,
                                                                                                                )
                                                                                                              : customerReceiptMatch
                                                                                                                ? handleCustomerReceiptRequest(
                                                                                                                    request,
                                                                                                                    database,
                                                                                                                    env,
                                                                                                                    decodeURIComponent(
                                                                                                                      customerReceiptMatch[1],
                                                                                                                    ),
                                                                                                                  )
                                                                                                                : customerOrderDetailMatch
                                                                                                                  ? handleCustomerOrderDetailRequest(
                                                                                                                      request,
                                                                                                                      database,
                                                                                                                      env,
                                                                                                                      decodeURIComponent(
                                                                                                                        customerOrderDetailMatch[1],
                                                                                                                      ),
                                                                                                                    )
                                                                                                                  : trackingMatch
                                                                                                                    ? handleTrackingRequest(
                                                                                                                        request,
                                                                                                                        database,
                                                                                                                        env,
                                                                                                                        decodeURIComponent(
                                                                                                                          trackingMatch[1],
                                                                                                                        ),
                                                                                                                      )
                                                                                                                    : customerMarketingPreferencesMatch
                                                                                                                      ? handleCustomerMarketingPreferencesRequest(
                                                                                                                          request,
                                                                                                                          database,
                                                                                                                          env,
                                                                                                                        )
                                                                                                                      : customerOrderPreferencesMatch
                                                                                                                        ? handleCustomerOrderPreferencesRequest(
                                                                                                                            request,
                                                                                                                            database,
                                                                                                                            env,
                                                                                                                          )
                                                                                                                        : customerLoyaltyMatch
                                                                                                                          ? handleCustomerLoyaltyRequest(
                                                                                                                              request,
                                                                                                                              database,
                                                                                                                              env,
                                                                                                                            )
                                                                                                                          : customerProfileMatch
                                                                                                                            ? handleCustomerProfileRequest(
                                                                                                                                request,
                                                                                                                                database,
                                                                                                                                env,
                                                                                                                              )
                                                                                                                            : paymentAttemptMatch
                                                                                                                              ? handlePaymentAttemptRequest(
                                                                                                                                  request,
                                                                                                                                  database,
                                                                                                                                  decodeURIComponent(
                                                                                                                                    paymentAttemptMatch[1],
                                                                                                                                  ),
                                                                                                                                  env,
                                                                                                                                )
                                                                                                                              : paymentAttemptRecoveryMatch
                                                                                                                                ? handlePaymentAttemptRecoveryRequest(
                                                                                                                                    request,
                                                                                                                                    database,
                                                                                                                                  )
                                                                                                                              : paymentFinalizationMatch
                                                                                                                                ? handleNativeOrderFinalizationRequest(
                                                                                                                                    request,
                                                                                                                                    database,
                                                                                                                                    decodeURIComponent(
                                                                                                                                      paymentFinalizationMatch[1],
                                                                                                                                    ),
                                                                                                                                    undefined,
                                                                                                                                    env.DEFAULT_ORGANIZATION_ID,
                                                                                                                                    env,
                                                                                                                                  )
                                                                                                                                : sitemapXmlMatch
                                                                                                                                  ? handleSitemapXmlRequest(
                                                                                                                                      request,
                                                                                                                                      database,
                                                                                                                                      env.CMS_ORGANIZATION_ID ??
                                                                                                                                        env.DEFAULT_ORGANIZATION_ID,
                                                                                                                                      env.PUBLIC_SITE_URL,
                                                                                                                                    )
                                                                                                                                : sitemapMatch
                                                                                                                                  ? handleSitemapRequest(
                                                                                                                                      request,
                                                                                                                                      database,
                                                                                                                                      env.CMS_ORGANIZATION_ID ??
                                                                                                                                        env.DEFAULT_ORGANIZATION_ID,
                                                                                                                                    )
                                                                                                                                                                                                  : catalogCategoriesMatch
                                                                                                                                                                                                    ? handleCatalogCategoriesRequest(
                                                                                                                                                                                                        request,
                                                                                                                                                                                                        database,
                                                                                                                                                                                                      )
                                                                                                                                                                                                  : categoriesMatch
                                                                                                                                    ? handleCategoryRequest(
                                                                                                                                        request,
                                                                                                                                        database,
                                                                                                                                        env.CMS_ORGANIZATION_ID ??
                                                                                                                                          env.DEFAULT_ORGANIZATION_ID,
                                                                                                                                      )
                                                                                                                                    : categoryMatch
                                                                                                                                      ? handleCategoryRequest(
                                                                                                                                          request,
                                                                                                                                          database,
                                                                                                                                          env.CMS_ORGANIZATION_ID ??
                                                                                                                                            env.DEFAULT_ORGANIZATION_ID,
                                                                                                                                          decodeURIComponent(
                                                                                                                                            categoryMatch[1],
                                                                                                                                          ),
                                                                                                                                        )
                                                                                                                                      : blogListMatch
                                                                                                                                        ? handleBlogRequest(
                                                                                                                                            request,
                                                                                                                                            database,
                                                                                                                                            env.CMS_ORGANIZATION_ID ??
                                                                                                                                              env.DEFAULT_ORGANIZATION_ID,
                                                                                                                                          )
                                                                                                                                        : blogPostMatch
                                                                                                                                          ? handleBlogRequest(
                                                                                                                                              request,
                                                                                                                                              database,
                                                                                                                                              env.CMS_ORGANIZATION_ID ??
                                                                                                                                                env.DEFAULT_ORGANIZATION_ID,
                                                                                                                                              decodeURIComponent(
                                                                                                                                                blogPostMatch[1],
                                                                                                                                              ),
                                                                                                                                            )
                                                                                                                                            : storefrontMetadataMatch
                                                                                                                                              ? handleStorefrontMetadataRequest(
                                                                                                                                                  request,
                                                                                                                                                  database,
                                                                                                                                                )
                                                                                                                                            : storefrontHomeMatch
                                                                                                                                              ? handleStorefrontHomeRequest(
                                                                                                                                                  request,
                                                                                                                                                  database,
                                                                                                                                                  env.CMS_ORGANIZATION_ID ??
                                                                                                                                                    env.DEFAULT_ORGANIZATION_ID,
                                                                                                                                                )
                                                                                                                                            : announcementMatch
                                                                                                                                            ? handleAnnouncementRequest(
                                                                                                                                                request,
                                                                                                                                                database,
                                                                                                                                                env.CMS_ORGANIZATION_ID ??
                                                                                                                                                  env.DEFAULT_ORGANIZATION_ID,
                                                                                                                                              )
                                                                                                                                            : navigationMatch
                                                                                                                                              ? handleNavigationRequest(
                                                                                                                                                  request,
                                                                                                                                                  database,
                                                                                                                                                  env.CMS_ORGANIZATION_ID ??
                                                                                                                                                    env.DEFAULT_ORGANIZATION_ID,
                                                                                                                                                )
                                                                                                                                              : cmsPageMatch
                                                                                                                                                ? handleCmsPageRequest(
                                                                                                                                                    request,
                                                                                                                                                    database,
                                                                                                                                                    decodeURIComponent(
                                                                                                                                                      cmsPageMatch[1],
                                                                                                                                                    ),
                                                                                                                                                    env.CMS_ORGANIZATION_ID ??
                                                                                                                                                      env.DEFAULT_ORGANIZATION_ID,
                                                                                                                                                  )
                                                                                                                                                : handleCatalogProductsRequest(
                                                                                                                                                    request,
                                                                                                                                                    database,
                                                                                                                                                  ),
        nativeDatabaseRole(nativeRouteMatches),
      );
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.append("Vary", "Origin");
      }
      return new Response(nativeResponse.body, {
        status: nativeResponse.status,
        headers,
      });
    } catch (error) {
      logNativeRouteFailure(error, id, nativeRouteMatches);
      return nativeRouteFailureResponse(error, id);
    }
  }

  const requestedNativeRole = nativeDatabaseRole(nativeRouteMatches);
  const requestedNativeRoute =
    Object.values(nativeRouteMatches).some(Boolean) || complianceNativeMatch;
  if (
    requestedNativeRoute &&
    !hasConfiguredDatabaseForRole(env, requestedNativeRole)
  ) {
    return jsonError("database_not_configured", id, 503);
  }

  if (request.method === "OPTIONS") {
    if (request.headers.get("Origin") && !origin)
      return new Response("Forbidden", {
        status: 403,
        headers: { "X-Request-ID": id },
      });
    const headers = new Headers({
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type,Authorization,Idempotency-Key,X-Request-ID",
      "Access-Control-Max-Age": "600",
      "X-Request-ID": id,
    });
    if (origin) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Credentials", "true");
      headers.set("Vary", "Origin");
    }
    return new Response(null, { status: 204, headers });
  }

  return jsonError("route_not_implemented", id, 404);
}
