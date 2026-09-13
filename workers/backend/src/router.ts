import {
  withWorkerDatabase,
  type WorkerDatabaseEnv,
  type WorkerDatabaseRole,
} from "./database.ts";
import {
  handleCatalogProductRequest,
  handleCatalogProductsRequest,
  handleCatalogSearchSuggestionsRequest,
  handleCollectionsRequest,
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
import { handleInventoryAvailabilityRequest } from "./inventory.ts";
import { handleCheckoutPreviewRequest, handleCheckoutSessionRequest, type CheckoutEnv } from "./checkout.ts";
import {
  handleWorkerWebhookRequest,
  type WorkerWebhookEnv,
} from "./webhooks.ts";
import {
  handleCustomerOrderDetailRequest,
  handleCustomerOrdersRequest,
  type OrderReadEnv,
} from "./orders.ts";
import { handleCustomerReceiptRequest } from "./orders.ts";
import { handleCustomerProfileRequest } from "./profile.ts";
import {
  handlePaymentAttemptRequest,
  type PaymentAttemptEnv,
} from "./payment-attempts.ts";
import { handleCmsPageRequest } from "./cms.ts";
import { handleNavigationRequest } from "./navigation.ts";
import { handleAnnouncementRequest } from "./announcement.ts";
import { handleBlogRequest } from "./blog.ts";
import { handleCategoryRequest } from "./category.ts";
import { handleSitemapRequest } from "./sitemap.ts";
import { handleCmsAdminPageRequest } from "./cms-admin.ts";
import { handleCmsAdminNavigationRequest } from "./navigation-admin.ts";
import { handleCmsAdminAnnouncementRequest } from "./announcement-admin.ts";
import { handleCmsAdminBlogRequest } from "./blog-admin.ts";
import { handleCmsAdminCategoryRequest } from "./category-admin.ts";
import { handleCmsAdminMediaDeleteRequest, handleCmsAdminMediaListRequest, handleCmsAdminMediaUploadRequest } from "./media-admin.ts";
import { handleNativeOrderFinalizationRequest } from "./order-finalization.ts";
import { handleComplianceRequest } from "./compliance.ts";
import { handleWishlistRequest } from "./wishlist.ts";
import {
  handleOrderCancellationRequest,
  handleOrderReturnRequest,
} from "./order-mutations.ts";
import { handleAdminRefundRequest } from "./admin-refund.ts";
import { handlePaymentHealthRequest } from "./payment-health.ts";
import { handlePaymentMethodsRequest } from "./payment-methods.ts";
import { handleDeliveryShipmentsRequest } from "./delivery-admin.ts";
import { handleInvoiceCreateRequest, handleInvoiceLifecycleRequest, handleInvoiceListRequest } from "./invoice-admin.ts";
import { handlePayPalConfirmationRequest } from "./paypal-confirm.ts";
import { handleTrackingRequest } from "./tracking.ts";

export interface BackendEnv
  extends CheckoutEnv, WorkerWebhookEnv, OrderReadEnv, PaymentAttemptEnv {
  ALLOWED_ORIGINS?: string;
  CMS_ORGANIZATION_ID?: string;
  DEFAULT_ORGANIZATION_ID?: string;
  CMS_ADMIN_JWT_SECRET?: string;
  SUPABASE_URL?: string;
  APP_HYPERDRIVE?: { connectionString: string };
  MEDUSA_HYPERDRIVE?: { connectionString: string };
  APP_DB_URL?: string;
  MEDUSA_DB_URL?: string;
  HYPERDRIVE?: { connectionString: string };
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
      env.MEDUSA_DB_URL ||
      env.HYPERDRIVE?.connectionString,
  );
}

function hasConfiguredDatabaseForRole(
  env: BackendEnv,
  role: WorkerDatabaseRole,
): boolean {
  if (role === "app") {
    return Boolean(
      env.APP_HYPERDRIVE?.connectionString ||
        env.APP_DB_URL,
    );
  }
  return Boolean(
    env.MEDUSA_HYPERDRIVE?.connectionString ||
      env.MEDUSA_DB_URL ||
      env.HYPERDRIVE?.connectionString,
  );
}

export function nativeDatabaseRole(
  matches: Record<string, unknown>,
): WorkerDatabaseRole {
  const appRouteKeys = [
    "cmsPageMatch",
    "navigationMatch",
    "announcementMatch",
    "blogListMatch",
    "blogPostMatch",
    "categoriesMatch",
    "categoryMatch",
    "sitemapMatch",
    "cmsAdminCreateMatch",
    "cmsAdminUpdateMatch",
    "cmsAdminNavigationMatch",
    "cmsAdminNavigationPublishMatch",
    "cmsAdminAnnouncementMatch",
    "cmsAdminBlogMatch",
    "cmsAdminBlogDetailMatch",
    "cmsAdminCategoryMatch",
    "cmsAdminMediaListMatch",
    "cmsAdminMediaDetailMatch",
    "customerProfileMatch",
    "paymentHealthMatch",
    "webhookMatch",
  ];
  return appRouteKeys.some((key) => Boolean(matches[key])) ? "app" : "medusa";
}

export async function handleBackendRequest(
  request: Request,
  env: BackendEnv,
): Promise<Response> {
  const id = requestId(request);
  const origin = allowedOrigin(request, env);

  const path = new URL(request.url).pathname;
  if (request.method === "GET" && (path === "/healthz" || path === "/readyz")) {
    const ready =
      path === "/healthz" || hasConfiguredDatabase(env);
    const body = JSON.stringify({
      status: ready ? "ok" : "not_ready",
      runtime: "cloudflare_worker",
      database: hasConfiguredDatabase(env),
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
  const collectionsMatch = request.method === "GET" && path === "/store/collections";
  const searchSuggestionsMatch = request.method === "GET" && path === "/store/search/suggestions";
  const collectionMatch = request.method === "GET" ? path.match(/^\/store\/collections\/([^/]+)$/) : null;
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
  const cartReconcileMatch = request.method === "POST" && path === "/store/cart/reconcile";
  const checkoutMatch =
    request.method === "POST" && path === "/store/checkout/session";
  const checkoutPreviewMatch = request.method === "POST" && path === "/store/checkout/preview";
  const paypalConfirmMatch =
    request.method === "POST" && path === "/store/checkout/paypal/confirm";
  const webhookMatch =
    request.method === "POST"
      ? path.match(/^\/webhooks\/(stripe|paypal|xendit|pancake)$/)
      : null;
  const customerOrdersMatch =
    request.method === "GET" && path === "/store/customers/me/orders";
  const customerOrderDetailMatch =
    request.method === "GET"
      ? path.match(/^\/store\/customers\/me\/orders\/([^/]+)$/)
      : null;
  const trackingMatch = request.method === "GET"
    ? path.match(/^\/store\/tracking\/(.+)$/)
    : null;
  const customerOrderCancelMatch =
    request.method === "POST"
      ? path.match(/^\/store\/customers\/me\/orders\/([^/]+)\/cancel$/)
      : null;
  const orderReturnMatch = request.method === "POST" && path === "/store/orders/return";
  const adminRefundMatch = request.method === "POST"
    ? path.match(/^\/(?:api\/)?admin\/orders\/([^/]+)\/refund$/)
    : null;
  const paymentHealthMatch = request.method === "GET" && (path === "/api/admin/payment-health" || path === "/admin/payment-health");
  const paymentMethodsMatch = request.method === "GET" && path === "/store/payment-methods";
  const deliveryShipmentsMatch = (request.method === "GET" || request.method === "POST") && (path === "/api/admin/delivery-logistics/shipments" || path === "/admin/delivery-logistics/shipments");
  const invoiceListMatch = request.method === "GET" && (path === "/api/admin/invoices" || path === "/admin/invoices");
  const invoiceCreateMatch = request.method === "POST" && (path === "/api/admin/invoices" || path === "/admin/invoices");
  const invoiceLifecycleMatch = request.method === "POST"
    ? path.match(/^\/(?:api\/)?admin\/invoices\/([^/]+)\/lifecycle$/)
    : null;
  const customerReceiptMatch =
    request.method === "GET"
      ? path.match(/^\/store\/customers\/me\/orders\/([^/]+)\/receipt$/)
      : null;
  const customerProfileMatch =
    (request.method === "GET" || request.method === "PUT") &&
    path === "/store/customers/me";
  const paymentAttemptMatch =
    request.method === "GET"
      ? path.match(/^\/store\/checkout-intents\/([^/]+)$/)
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
  const cmsAdminCreateMatch = request.method === "POST" && (path === "/admin/cms/pages" || path === "/api/admin/cms/pages");
  const cmsAdminUpdateMatch = (request.method === "PUT" || request.method === "PATCH")
    ? path.match(/^\/(?:api\/)?admin\/cms\/pages\/([^/]+)$/)
    : null;
  const cmsAdminNavigationMatch = request.method === "PUT" && (path === "/admin/cms/navigation" || path === "/api/admin/cms/navigation");
  const cmsAdminNavigationPublishMatch = request.method === "POST" && (path === "/admin/cms/navigation/publish" || path === "/api/admin/cms/navigation/publish");
  const cmsAdminAnnouncementMatch = ["GET", "PUT", "DELETE"].includes(request.method) && (path === "/admin/cms/announcement" || path === "/api/admin/cms/announcement");
  const cmsAdminBlogMatch = ["GET", "POST"].includes(request.method) && (path === "/admin/cms/blog" || path === "/api/admin/cms/blog");
  const cmsAdminBlogDetailMatch = ["GET", "PUT", "DELETE"].includes(request.method) ? path.match(/^\/(?:api\/)?admin\/cms\/blog\/([^/]+)$/) : null;
  const cmsAdminCategoryMatch = ["GET", "POST"].includes(request.method) && (path === "/admin/cms/category-content" || path === "/api/admin/cms/category-content");
  const cmsAdminMediaListMatch = request.method === "GET" && (path === "/admin/cms/media" || path === "/api/admin/cms/media");
  const cmsAdminMediaUploadMatch = request.method === "POST" && (path === "/admin/catalog/media" || path === "/api/admin/catalog/media");
  const cmsAdminMediaDetailMatch = request.method === "DELETE" ? path.match(/^\/(?:api\/)?admin\/cms\/media\/([^/]+)$/) : null;
  const navigationMatch = request.method === "GET" && path === "/store/navigation";
  const announcementMatch = request.method === "GET" && path === "/store/announcements";
  const blogListMatch = request.method === "GET" && path === "/store/blog";
  const blogPostMatch = request.method === "GET" ? path.match(/^\/store\/blog\/([^/]+)$/) : null;
  const categoriesMatch = request.method === "GET" && path === "/store/categories";
  const categoryMatch = request.method === "GET" ? path.match(/^\/store\/categories\/([^/]+)$/) : null;
  const sitemapMatch = request.method === "GET" && path === "/store/sitemap";
  const complianceExportMatch = request.method === "GET" && path === "/compliance/export";
  const complianceErasureMatch = request.method === "POST" && path === "/compliance/erasure";
  const complianceRetentionMatch = request.method === "POST" && path === "/compliance/retention/anonymize-addresses";
  const wishlistMatch = path === "/store/wishlist" && ["GET", "POST", "DELETE"].includes(request.method);
  const wishlistSyncMatch = request.method === "POST" && path === "/store/wishlist/sync";
  const nativeRouteMatches = {
    cmsPageMatch,
    navigationMatch,
    announcementMatch,
    blogListMatch,
    blogPostMatch,
    categoriesMatch,
    categoryMatch,
    searchSuggestionsMatch,
    sitemapMatch,
    cmsAdminCreateMatch,
    cmsAdminUpdateMatch,
    cmsAdminNavigationMatch,
    cmsAdminNavigationPublishMatch,
    cmsAdminAnnouncementMatch,
    cmsAdminBlogMatch,
    cmsAdminBlogDetailMatch,
    cmsAdminCategoryMatch,
    cmsAdminMediaListMatch,
    cmsAdminMediaDetailMatch,
    cmsAdminMediaUploadMatch,
    paymentHealthMatch,
    paymentMethodsMatch,
    invoiceListMatch,
    invoiceCreateMatch,
    invoiceLifecycleMatch,
    customerProfileMatch,
    webhookMatch,
    paypalConfirmMatch,
    trackingMatch,
  };
  const complianceNativeMatch = complianceExportMatch || complianceErasureMatch || complianceRetentionMatch;
  const appOnlyNativeMatch =
    Object.values(nativeRouteMatches).some(Boolean) ||
    Boolean(
      cmsAdminMediaUploadMatch ||
        cmsAdminMediaDetailMatch ||
        paymentAttemptMatch,
    );
  const crossDatabaseNativeMatch = Boolean(
    complianceNativeMatch ||
      customerOrderCancelMatch ||
      orderReturnMatch ||
      adminRefundMatch ||
      invoiceCreateMatch ||
      checkoutMatch ||
      paypalConfirmMatch ||
      paymentFinalizationMatch ||
      wishlistMatch ||
      wishlistSyncMatch ||
      cmsAdminMediaDetailMatch,
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
  if (complianceNativeMatch && hasConfiguredDatabaseForRole(env, "app") && hasConfiguredDatabaseForRole(env, "medusa")) {
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
      return new Response(nativeResponse.body, { status: nativeResponse.status, headers });
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
  if (adminRefundMatch && hasConfiguredDatabaseForRole(env, "app") && hasConfiguredDatabaseForRole(env, "medusa")) {
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
      return new Response(nativeResponse.body, { status: nativeResponse.status, headers });
    } catch {
      return jsonError("refund_unavailable", id, 503);
    }
  }
  if (paymentHealthMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(env as BackendEnv & WorkerDatabaseEnv, (database) => handlePaymentHealthRequest(request, database, env), "app");
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.append("Vary", "Origin");
      }
      return new Response(nativeResponse.body, { status: nativeResponse.status, headers });
    } catch {
      return jsonError("payment_health_unavailable", id, 503);
    }
  }
  if (paymentMethodsMatch) {
    const nativeResponse = hasConfiguredDatabaseForRole(env, "app")
      ? await withWorkerDatabase(env as BackendEnv & WorkerDatabaseEnv, (database) => handlePaymentMethodsRequest(request, env, database), "app")
      : await handlePaymentMethodsRequest(request, env);
    const headers = responseHeaders(nativeResponse.headers, origin);
    headers.set("X-Request-ID", id);
    return new Response(nativeResponse.body, { status: nativeResponse.status, headers });
  }
  if (deliveryShipmentsMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(env as BackendEnv & WorkerDatabaseEnv, (database) => handleDeliveryShipmentsRequest(request, database, env), "app");
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) { headers.set("Access-Control-Allow-Origin", origin); headers.set("Access-Control-Allow-Credentials", "true"); headers.append("Vary", "Origin"); }
      return new Response(nativeResponse.body, { status: nativeResponse.status, headers });
    } catch { return jsonError("delivery_unavailable", id, 503); }
  }
  if ((invoiceListMatch || invoiceLifecycleMatch) && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => invoiceListMatch
          ? handleInvoiceListRequest(request, database, env)
          : handleInvoiceLifecycleRequest(request, database, env, decodeURIComponent(invoiceLifecycleMatch![1])),
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
      return new Response(nativeResponse.body, { status: nativeResponse.status, headers });
    } catch {
      return jsonError("invoice_unavailable", id, 503);
    }
  }
  if (cmsAdminMediaUploadMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(env as BackendEnv & WorkerDatabaseEnv, (database) => handleCmsAdminMediaUploadRequest(request, database, env), "app");
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) { headers.set("Access-Control-Allow-Origin", origin); headers.set("Access-Control-Allow-Credentials", "true"); headers.append("Vary", "Origin"); }
      return new Response(nativeResponse.body, { status: nativeResponse.status, headers });
    } catch { return jsonError("media_upload_unavailable", id, 503); }
  }
  if (cmsAdminMediaDetailMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) => withWorkerDatabase(
          env as BackendEnv & WorkerDatabaseEnv,
          (medusaDatabase) => handleCmsAdminMediaDeleteRequest(request, appDatabase, medusaDatabase, env, decodeURIComponent(cmsAdminMediaDetailMatch![1])),
          "medusa",
        ),
        "app",
      );
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) { headers.set("Access-Control-Allow-Origin", origin); headers.set("Access-Control-Allow-Credentials", "true"); headers.append("Vary", "Origin"); }
      return new Response(nativeResponse.body, { status: nativeResponse.status, headers });
    } catch { return jsonError("media_delete_unavailable", id, 503); }
  }
  if (invoiceCreateMatch && hasConfiguredDatabaseForRole(env, "app") && hasConfiguredDatabaseForRole(env, "medusa")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) => withWorkerDatabase(
          env as BackendEnv & WorkerDatabaseEnv,
          (medusaDatabase) => handleInvoiceCreateRequest(request, appDatabase, medusaDatabase, env),
          "medusa",
        ),
        "app",
      );
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) { headers.set("Access-Control-Allow-Origin", origin); headers.set("Access-Control-Allow-Credentials", "true"); headers.append("Vary", "Origin"); }
      return new Response(nativeResponse.body, { status: nativeResponse.status, headers });
    } catch { return jsonError("invoice_create_unavailable", id, 503); }
  }
  if (checkoutMatch && hasConfiguredDatabaseForRole(env, "app") && hasConfiguredDatabaseForRole(env, "medusa")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) => withWorkerDatabase(
          env as BackendEnv & WorkerDatabaseEnv,
          (commerceDatabase) => handleCheckoutSessionRequest(request, commerceDatabase, env, appDatabase),
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
      return new Response(nativeResponse.body, { status: nativeResponse.status, headers });
    } catch {
      return jsonError("checkout_unavailable", id, 503);
    }
  }
  if (checkoutPreviewMatch && hasConfiguredDatabaseForRole(env, "medusa")) {
    try {
      const nativeResponse = await withWorkerDatabase(env as BackendEnv & WorkerDatabaseEnv, (database) => handleCheckoutPreviewRequest(request, database), "medusa");
      const headers = responseHeaders(nativeResponse.headers, origin);
      headers.set("X-Request-ID", id);
      return new Response(nativeResponse.body, { status: nativeResponse.status, headers });
    } catch {
      return jsonError("checkout_preview_unavailable", id, 503);
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
      return new Response(nativeResponse.body, { status: nativeResponse.status, headers });
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
      return new Response(nativeResponse.body, { status: nativeResponse.status, headers });
    } catch {
      return jsonError("paypal_confirmation_unavailable", id, 503);
    }
  }
  if (paymentAttemptMatch && hasConfiguredDatabaseForRole(env, "app")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) => handlePaymentAttemptRequest(request, database, decodeURIComponent(paymentAttemptMatch![1]), env),
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
      return new Response(nativeResponse.body, { status: nativeResponse.status, headers });
    } catch {
      return jsonError("payment_attempt_unavailable", id, 503);
    }
  }
  if (paymentFinalizationMatch && hasConfiguredDatabaseForRole(env, "app") && hasConfiguredDatabaseForRole(env, "medusa")) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (appDatabase) => withWorkerDatabase(
          env as BackendEnv & WorkerDatabaseEnv,
          (commerceDatabase) => handleNativeOrderFinalizationRequest(request, commerceDatabase, decodeURIComponent(paymentFinalizationMatch![1]), appDatabase, env.DEFAULT_ORGANIZATION_ID),
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
      return new Response(nativeResponse.body, { status: nativeResponse.status, headers });
    } catch {
      return jsonError("order_finalization_unavailable", id, 503);
    }
  }
  if ((wishlistMatch || wishlistSyncMatch) && hasConfiguredDatabaseForRole(env, "app") && hasConfiguredDatabaseForRole(env, "medusa")) {
    try {
      const nativeResponse = await handleWishlistRequest(request, env, wishlistSyncMatch);
      const headers = new Headers(nativeResponse.headers);
      headers.set("X-Request-ID", id);
      headers.set("Referrer-Policy", "no-referrer");
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.append("Vary", "Origin");
      }
      return new Response(nativeResponse.body, { status: nativeResponse.status, headers });
    } catch {
      return jsonError("wishlist_unavailable", id, 503);
    }
  }
  if (
    ((request.method === "GET" &&
      (path === "/store/products" ||
        regionsMatch ||
        collectionsMatch ||
        searchSuggestionsMatch ||
        collectionMatch ||
        productMatch ||
        cmsPageMatch ||
        navigationMatch ||
        announcementMatch ||
        blogListMatch ||
        blogPostMatch ||
        categoriesMatch ||
        categoryMatch ||
        sitemapMatch ||
        cartMatch ||
        inventoryMatch ||
        customerOrdersMatch ||
        customerOrderDetailMatch ||
        trackingMatch ||
        customerReceiptMatch)) ||
      customerProfileMatch ||
      paymentAttemptMatch ||
      paymentFinalizationMatch ||
      cartLineMatch ||
      cartAddMatch ||
      cartCreateMatch ||
      cartUpdateMatch ||
      cmsAdminCreateMatch ||
      cmsAdminUpdateMatch ||
      cmsAdminNavigationMatch ||
      cmsAdminNavigationPublishMatch ||
      cmsAdminAnnouncementMatch ||
      cmsAdminBlogMatch ||
      cmsAdminBlogDetailMatch ||
      cmsAdminCategoryMatch ||
      cmsAdminMediaListMatch ||
      checkoutMatch ||
      webhookMatch) &&
    hasConfiguredDatabaseForRole(env, nativeDatabaseRole(nativeRouteMatches))
  ) {
    try {
      const nativeResponse = await withWorkerDatabase(
        env as BackendEnv & WorkerDatabaseEnv,
        (database) =>
        cmsAdminBlogMatch
          ? handleCmsAdminBlogRequest(request, database, env)
          : cmsAdminBlogDetailMatch
            ? handleCmsAdminBlogRequest(request, database, env, decodeURIComponent(cmsAdminBlogDetailMatch[1]))
            : cmsAdminCategoryMatch
            ? handleCmsAdminCategoryRequest(request, database, env)
              : cmsAdminMediaListMatch
                ? handleCmsAdminMediaListRequest(request, database, env)
              : cmsAdminAnnouncementMatch
          ? handleCmsAdminAnnouncementRequest(request, database, env)
          : cmsAdminNavigationMatch
          ? handleCmsAdminNavigationRequest(request, database, env)
          : cmsAdminNavigationPublishMatch
            ? handleCmsAdminNavigationRequest(request, database, env, true)
            : cmsAdminCreateMatch
          ? handleCmsAdminPageRequest(request, database, env)
          : cmsAdminUpdateMatch
            ? handleCmsAdminPageRequest(request, database, env, decodeURIComponent(cmsAdminUpdateMatch[1]))
            : productMatch
          ? handleCatalogProductRequest(
              request,
              database,
              decodeURIComponent(productMatch[1]),
            )
          : regionsMatch
            ? handleRegionsRequest(request, database)
            : searchSuggestionsMatch
              ? handleCatalogSearchSuggestionsRequest(request, database)
            : collectionsMatch
              ? handleCollectionsRequest(request, database)
              : collectionMatch
                ? handleCollectionRequest(request, database, decodeURIComponent(collectionMatch[1]))
          : cartMatch
            ? handleCartRequest(
                request,
                database,
                decodeURIComponent(cartMatch[1]),
              )
            : inventoryMatch
              ? handleInventoryAvailabilityRequest(
                  request,
                  database,
                  decodeURIComponent(inventoryMatch[1]),
                )
              : cartLineMatch
                ? handleCartLineQuantityRequest(
                    request,
                    database,
                    decodeURIComponent(cartLineMatch[1]),
                    decodeURIComponent(cartLineMatch[2]),
                  )
            : cartAddMatch
                  ? handleAddCartLineRequest(
                      request,
                      database,
                      decodeURIComponent(cartAddMatch[1]),
                    )
                  : cartCreateMatch
                    ? handleCreateCartRequest(request, database)
                  : cartUpdateMatch
                    ? handleCartUpdateRequest(
                        request,
                        database,
                        decodeURIComponent(cartUpdateMatch[1]),
                      )
                  : checkoutMatch
                    ? handleCheckoutSessionRequest(request, database, env)
                    : webhookMatch
                      ? handleWorkerWebhookRequest(
                          request,
                          database,
                          webhookMatch[1] as
                            | "stripe"
                            | "paypal"
                            | "xendit"
                            | "pancake",
                          env,
                        )
                      : customerOrdersMatch
                        ? handleCustomerOrdersRequest(request, database, env)
                      : customerReceiptMatch
                        ? handleCustomerReceiptRequest(request, database, env, decodeURIComponent(customerReceiptMatch[1]))
                      : customerOrderDetailMatch
                          ? handleCustomerOrderDetailRequest(
                              request,
                              database,
                              env,
                              decodeURIComponent(customerOrderDetailMatch[1]),
                            )
                          : trackingMatch
                            ? handleTrackingRequest(
                                request,
                                database,
                                env,
                                decodeURIComponent(trackingMatch[1]),
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
                                  decodeURIComponent(paymentAttemptMatch[1]),
                                  env,
                                )
                              : paymentFinalizationMatch
                                ? handleNativeOrderFinalizationRequest(
                                    request,
                                    database,
                                    decodeURIComponent(paymentFinalizationMatch[1]),
                                  )
                              : sitemapMatch
                                ? handleSitemapRequest(request, database, env.CMS_ORGANIZATION_ID ?? env.DEFAULT_ORGANIZATION_ID)
                                : categoriesMatch
                                ? handleCategoryRequest(request, database, env.CMS_ORGANIZATION_ID ?? env.DEFAULT_ORGANIZATION_ID)
                                : categoryMatch
                                ? handleCategoryRequest(request, database, env.CMS_ORGANIZATION_ID ?? env.DEFAULT_ORGANIZATION_ID, decodeURIComponent(categoryMatch[1]))
                                : blogListMatch
                                ? handleBlogRequest(request, database, env.CMS_ORGANIZATION_ID ?? env.DEFAULT_ORGANIZATION_ID)
                                : blogPostMatch
                                  ? handleBlogRequest(request, database, env.CMS_ORGANIZATION_ID ?? env.DEFAULT_ORGANIZATION_ID, decodeURIComponent(blogPostMatch[1]))
                                : announcementMatch
                                ? handleAnnouncementRequest(request, database, env.CMS_ORGANIZATION_ID ?? env.DEFAULT_ORGANIZATION_ID)
                                : navigationMatch
                                ? handleNavigationRequest(
                                    request,
                                    database,
                                    env.CMS_ORGANIZATION_ID ?? env.DEFAULT_ORGANIZATION_ID,
                                  )
                                : cmsPageMatch
                                ? handleCmsPageRequest(
                                    request,
                                    database,
                                    decodeURIComponent(cmsPageMatch[1]),
                                    env.CMS_ORGANIZATION_ID ?? env.DEFAULT_ORGANIZATION_ID,
                                  )
                                : handleCatalogProductsRequest(request, database),
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
    } catch {
      return jsonError("catalog_unavailable", id, 503);
    }
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
