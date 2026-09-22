#!/usr/bin/env node
/**
 * Verifies that the checked-in admin OpenAPI YAML has exactly one operation for
 * every implemented App Router admin API method.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiRoot = path.join(root, "apps", "web", "src", "app", "api");
const documentPath = path.join(root, "internal", "reference", "admin-open-api.yaml");
const documentSource = fs.readFileSync(documentPath, "utf8");

if (/^security:\n/m.test(documentSource)) {
  throw new Error("OpenAPI must not apply a global authentication requirement; security is operation-specific.");
}

if (!/    ProblemResponse:\n/.test(documentSource) || !/required: \[type, title, status, detail, error, code, requestId, retryable\]/.test(documentSource)) {
  throw new Error("Admin OpenAPI must define the strict RFC problem response schema.");
}
if (/type: undefined\b/.test(documentSource)) {
  throw new Error("Admin OpenAPI contains an invalid undefined schema type.");
}
const operationMetadataMarkers = (documentSource.match(/x-contract-metadata-status: (?:source-inferred|explicit)/g) ?? []).length;
const operationIds = (documentSource.match(/^      operationId:/gm) ?? []).length;
if (operationMetadataMarkers !== operationIds) {
  throw new Error(`Admin OpenAPI metadata authority marker mismatch: ${operationMetadataMarkers} markers for ${operationIds} operations.`);
}
if (!/x-contract-metadata-warning: Permission, tenant scope, and replay fields are static source evidence/.test(documentSource)) {
  throw new Error("Admin OpenAPI must disclose that security metadata requires executable verification.");
}
const e2eAuthContract = documentSource.match(/  \/auth\/e2e:\n([\s\S]*?)(?=^  \/[^\n]+:\n|^components:\n)/m)?.[1] ?? "";
if (!e2eAuthContract ||
    (e2eAuthContract.match(/^      security: \[\]$/gm) ?? []).length !== 2 ||
    (e2eAuthContract.match(/^      x-permission: "local-e2e-credentials"$/gm) ?? []).length !== 2) {
  throw new Error("E2E auth OpenAPI must describe credential-gated local access, not staff-session security.");
}

function operationContract(apiPath, method) {
  const marker = `  ${apiPath}:\n`;
  const start = documentSource.indexOf(marker);
  if (start < 0) return "";
  const nextPath = documentSource.indexOf("\n  /", start + marker.length);
  const components = documentSource.indexOf("\ncomponents:", start + marker.length);
  const pathEnd = [nextPath, components].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? documentSource.length;
  const pathBlock = documentSource.slice(start + marker.length, pathEnd);
  const methodMatches = [...pathBlock.matchAll(/^    (get|post|put|patch|delete):\n/gm)];
  const selected = methodMatches.findIndex((match) => match[1] === method);
  if (selected < 0) return "";
  const methodStart = methodMatches[selected].index + methodMatches[selected][0].length;
  return pathBlock.slice(methodStart, methodMatches[selected + 1]?.index ?? pathBlock.length);
}
for (const [apiPath, method, authClass, scheme] of [
  ["/admin/catalog/products", "post", "staff-session", "StaffSession"],
  ["/account/profile", "patch", "customer-session", "CustomerSession"],
  ["/cart/line", "put", "cart-capability", "CartCapability"],
  ["/cart/resume", "get", "cart-recovery-capability", "CartRecoveryToken"],
  ["/payments/checkout-intents/{correlationId}", "get", "payment-attempt-capability", "CheckoutAttemptCapability"],
  ["/checkout/cod-place-order", "post", "customer-and-cart-capability", "CartCapability"],
  ["/cms/preview", "get", "signed-preview-capability", "PreviewCapability"],
  ["/internal/invalidate-commerce-state", "post", "internal-secret", "InternalSecret"],
  ["/cron/payment-reconciliation", "get", "scheduled-job-credential", null],
  ["/webhooks/nango", "post", "provider-signature", null],
  ["/newsletter", "post", "public-origin-protected", null],
  ["/feature-mappings", "get", "public", null],
]) {
  const block = operationContract(apiPath, method);
  const schemePresent = !scheme || block.includes(`- ${scheme}: []`) || (authClass === "customer-and-cart-capability" && block.includes(`  ${scheme}: []`));
  if (!block || !block.includes(`x-authentication-class: "${authClass}"`) || !schemePresent) {
    throw new Error(`Incorrect or missing OpenAPI authentication metadata for ${method.toUpperCase()} ${apiPath}.`);
  }
}

function walkRoutes(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walkRoutes(absolute, out);
    else if (entry.name === "route.ts") out.push(absolute);
  }
  return out;
}

function toApiPath(file) {
  const relative = path.relative(apiRoot, path.dirname(file)).split(path.sep).join("/");
  return "/" + relative.replace(/\[([^\]]+)\]/g, "{$1}");
}

function hasDurableReplayBoundary(route, source) {
  if (/(withAdminMutationIdempotency|claimAdminIdempotency)/.test(source)) return true;
  const bridge = fs.readFileSync(path.join(root, "apps/web/src/lib/worker-admin-bridge.ts"), "utf8");
  if (route === "/admin/orders/{orderId}/refund") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/admin-refund.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /API_URL/.test(source) && /Idempotency-Key/.test(source) && /x-admin-step-up/.test(source) &&
      /resolveWorkerStaffPrincipal/.test(worker) && /stepUpValid\(request, env\)/.test(worker) &&
      /executeIdempotently\(store, scopedKey/.test(worker) && /organization_id/.test(worker) &&
      /handleAdminRefundRequest\(\s*request,\s*env,/.test(router);
  }
  if (route === "/admin/catalog/products" || route === "/admin/catalog/products/{id}") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/catalog-admin.ts"), "utf8");
    const commerceAdmin = fs.readFileSync(path.join(root, "workers/backend/src/admin-commerce.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    const deleteSaga = fs.readFileSync(path.join(root, "workers/backend/src/catalog-delete-saga.ts"), "utf8");
    const handler = route.endsWith("/{id}")
      ? /updateWorkerCatalogProductForAdmin/
      : /createWorkerCatalogProductForAdmin/;
    const catalogWriteReplay = /handleAdminCatalogProductMutationRequest[\s\S]*?executeIdempotently\([\s\S]{0,160}new HyperdriveIdempotencyStore\(commerceTransaction\)/.test(worker);
    const productDeleteReplay = route.endsWith("/{id}") &&
      /handleAdminCatalogProductDeleteRequest[\s\S]*?executeIdempotently\([\s\S]{0,160}new HyperdriveIdempotencyStore\(database\)/.test(commerceAdmin) &&
      /deleteCatalogProductWithProviderArchive[\s\S]*?archiveProvider:[\s\S]*?handleCatalogProviderSyncRequest[\s\S]*?deleteProduct:[\s\S]*?handleAdminCatalogProductDeleteRequest/.test(router) &&
      /request\.headers\.get\("Idempotency-Key"\)[\s\S]*?archiveHeaders\.set\("Idempotency-Key",\s*await archiveIdempotencyKey\(idempotencyKey\)\)/.test(deleteSaga) &&
      /return `catalog-provider-archive:\$\{suffix\}`/.test(deleteSaga);
    return handler.test(source) &&
      /workerAdminMutation\([\s\S]*?input\.idempotencyKey/.test(bridge) &&
      catalogWriteReplay &&
      (!route.endsWith("/{id}") || productDeleteReplay) &&
      /catalog_product_mutation_unavailable/.test(router);
  }
  if (route === "/admin/catalog/categories") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/admin-commerce.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /createWorkerProductCategoryForAdmin/.test(source) &&
      /createWorkerProductCategoryForAdmin[\s\S]*?workerAdminMutation/.test(bridge) &&
      /handleAdminCatalogCategoriesRequest[\s\S]*?executeIdempotently\([\s\S]*?catalog-category-finalize:[\s\S]*?INSERT INTO public\.audit_logs/.test(worker) &&
      /adminCatalogCategoriesMatch && request\.method === "POST"[\s\S]*?handleAdminCatalogCategoriesRequest/.test(router);
  }
  if (route === "/admin/campaigns/{id}") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/campaigns-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /proxyWorkerAdminRoute\(request,/.test(source) &&
      /handleAdminCampaignsRequest[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore/.test(worker) &&
      /adminCampaignDetailMatch[\s\S]*?handleAdminCampaignsRequest/.test(router);
  }
  if (route === "/admin/cms/block-presets" || route === "/admin/cms/block-presets/{id}") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/block-presets-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /WorkerCmsBlockPreset/.test(source) &&
      /executeIdempotently\(new HyperdriveIdempotencyStore\(database\)/.test(worker) &&
      /handleAdminBlockPresetsRequest/.test(worker) &&
      /cmsAdminBlockPreset(?:s|Detail)Match[\s\S]*?handleAdminBlockPresetsRequest/.test(router);
  }
  if (route === "/admin/cms/forms/settings") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/form-settings-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /WorkerCmsFormSettings/.test(source) &&
      /executeIdempotently\(new HyperdriveIdempotencyStore\(database\)/.test(worker) &&
      /handleAdminCmsFormSettingsRequest/.test(worker) &&
      /cmsAdminFormSettingsMatch[\s\S]*?handleAdminCmsFormSettingsRequest/.test(router);
  }
  if (route === "/admin/cms/experiments" || route === "/admin/cms/experiments/{id}") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/cms-experiments-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /WorkerCmsExperiment/.test(source) &&
      /executeIdempotently\(new HyperdriveIdempotencyStore\(database\)/.test(worker) &&
      /handleAdminCmsExperimentsRequest/.test(worker) &&
      /cmsAdminExperiment(?:s|Detail|Create)Match[\s\S]*?handleAdminCmsExperimentsRequest/.test(router);
  }
  if (route === "/admin/cms/components" || route === "/admin/cms/components/{id}") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/cms-components-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /WorkerCmsComponent/.test(source) &&
      /executeIdempotently\(new HyperdriveIdempotencyStore\(database\)/.test(worker) &&
      /handleAdminCmsComponentsRequest/.test(worker) &&
      /cmsAdminComponent(?:s|Detail)Match[\s\S]*?handleAdminCmsComponentsRequest/.test(router);
  }
  if (route.startsWith("/admin/cms/redirects")) {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/cms-redirects-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /WorkerCmsRedirect/.test(source) &&
      /executeIdempotently\(new HyperdriveIdempotencyStore\(database\)/.test(worker) &&
      /handleAdminCmsRedirectsRequest/.test(worker) &&
      /cmsAdminRedirect(?:s|Detail|Bulk|Export|Import|Resolve)Match[\s\S]*?handleAdminCmsRedirectsRequest/.test(router);
  }
  if (route === "/admin/delivery-logistics" || route === "/admin/delivery-logistics/operations") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/delivery-operations-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /WorkerDeliveryOperations/.test(source) &&
      /executeIdempotently\(new HyperdriveIdempotencyStore\(database\)/.test(worker) &&
      /handleAdminDeliveryOperationsRequest/.test(worker) &&
      /adminDeliveryOperationsMatch[\s\S]*?handleAdminDeliveryOperationsRequest/.test(router);
  }
  if (route === "/admin/payments/{id}/retry") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/payment-retry-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /mutateWorkerPaymentRetryForAdmin/.test(source) &&
      /mutateWorkerPaymentRetryForAdmin[\s\S]*?workerAdminMutation/.test(bridge) &&
      /handleAdminPaymentRetryRequest[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore/.test(worker) &&
      /adminPaymentRetryMatch[\s\S]*?handleAdminPaymentRetryRequest/.test(router);
  }
  if (route === "/admin/workflow/transition") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/workflow-transition-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /mutateWorkerWorkflowTransitionForAdmin/.test(source) &&
      /mutateWorkerWorkflowTransitionForAdmin[\s\S]*?workerAdminMutation/.test(bridge) &&
      /handleAdminWorkflowTransitionRequest[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore/.test(worker) &&
      /adminWorkflowTransitionMatch[\s\S]*?handleAdminWorkflowTransitionRequest/.test(router);
  }
  if (route === "/admin/voids") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/voids-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /fetchWorkerVoidsForAdmin|mutateWorkerVoidForAdmin/.test(source) &&
      /mutateWorkerVoidForAdmin[\s\S]*?workerAdminMutation/.test(bridge) &&
      /handleAdminVoidsRequest[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore/.test(worker) &&
      /adminVoidsMatch[\s\S]*?handleAdminVoidsRequest/.test(router);
  }
  if (route === "/admin/reconciliation") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/reconciliation-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /fetchWorkerReconciliationForAdmin/.test(source) && /handleAdminReconciliationRequest/.test(worker) && /adminReconciliationMatch[\s\S]*?handleAdminReconciliationRequest/.test(router);
  }
  if (route === "/admin/pin-approval") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/pin-approval-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /mutateWorkerPinApprovalForAdmin/.test(source) && /mutateWorkerPinApprovalForAdmin[\s\S]*?workerAdminMutation/.test(bridge) && /handleAdminPinApprovalRequest/.test(worker) && /adminPinApprovalMatch[\s\S]*?handleAdminPinApprovalRequest/.test(router);
  }
  if (route === "/admin/tracking-capabilities/revoke") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/tracking-capability-revoke-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /proxyWorkerAdminRoute/.test(source) &&
      /handleAdminTrackingCapabilityRevokeRequest/.test(worker) &&
      /executeIdempotently\(new HyperdriveIdempotencyStore/.test(worker) &&
      /adminTrackingCapabilityRevokeMatch[\s\S]*?handleAdminTrackingCapabilityRevokeRequest/.test(router);
  }
  if (route === "/integrations/couriers/telemetry") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/courier-telemetry.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /proxyWorkerPublicRoute/.test(source) &&
      /handleCourierTelemetryRequest/.test(worker) &&
      /courierTelemetryMatch[\s\S]*?handleCourierTelemetryRequest/.test(router);
  }
  if (route === "/admin/terminal-open-drawer") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/terminal-open-drawer-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /proxyWorkerAdminRoute/.test(source) && /handleAdminTerminalOpenDrawerRequest/.test(worker) && /executeIdempotently\(new HyperdriveIdempotencyStore/.test(worker) && /adminTerminalOpenDrawerMatch[\s\S]*?handleAdminTerminalOpenDrawerRequest/.test(router);
  }
  if (route === "/admin/crm/notes" || route === "/admin/crm/notes/{id}") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/crm-notes-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    const durableExecutions = [...worker.matchAll(/executeIdempotently\(/g)].length;
    return /WorkerCrmNote/.test(source) && /withWorkerTransaction\(database/.test(worker) &&
      /new HyperdriveIdempotencyStore\(tx\)/.test(worker) && durableExecutions >= 2 &&
      /handleAdminCrmNotesRequest/.test(worker) && /adminCrmNotesMatch[\s\S]*?handleAdminCrmNotesRequest/.test(router);
  }
  if (route === "/admin/crm/operations") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/crm-operations-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /WorkerCrmOperations/.test(source) && /executeIdempotently\(new HyperdriveIdempotencyStore\(database\)/.test(worker) && /handleAdminCrmOperationsRequest/.test(worker) && /adminCrmOperationsMatch[\s\S]*?handleAdminCrmOperationsRequest/.test(router);
  }
  if (route === "/admin/crm/bridge") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/crm-bridge-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /proxyWorkerAdminRoute\(request,/.test(source) &&
      /handleAdminCrmBridgeRequest/.test(worker) &&
      /executeIdempotently\(new HyperdriveIdempotencyStore/.test(worker) &&
      /adminCrmBridgeMatch[\s\S]*?handleAdminCrmBridgeRequest/.test(router);
  }
  if (["/admin/loyalty", "/admin/loyalty/points", "/admin/loyalty/rewards"].includes(route)) {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/loyalty-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /fetchWorkerAdminLoyalty|createWorkerAdminLoyalty|mutateWorkerAdminLoyalty/.test(source) && /executeIdempotently\(new HyperdriveIdempotencyStore\(database\)/.test(worker) && /handleAdminLoyalty(?:Request|PointsRequest|RewardsRequest)/.test(worker) && /adminLoyalty(?:Match|PointsMatch|RewardsMatch)[\s\S]*?handleAdminLoyalty/.test(router);
  }
  if (route === "/admin/profile") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/profile-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /saveWorkerAdminProfileForAdmin/.test(source) &&
      /saveWorkerAdminProfileForAdmin[\s\S]*?workerAdminMutation[\s\S]*?idempotencyKey/.test(bridge) &&
      /handleAdminProfileRequest[\s\S]*?executeIdempotently[\s\S]*?HyperdriveIdempotencyStore/.test(worker) &&
      /adminProfileMatch[\s\S]*?handleAdminProfileRequest/.test(router);
  }
  if (route === "/admin/storefront-public-metadata") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/storefront-metadata-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /saveWorkerStorefrontMetadataForAdmin/.test(source) &&
      /saveWorkerStorefrontMetadataForAdmin[\s\S]*?workerAdminMutation[\s\S]*?idempotencyKey/.test(bridge) &&
      /handleAdminStorefrontMetadataRequest[\s\S]*?executeIdempotently[\s\S]*?HyperdriveIdempotencyStore/.test(worker) &&
      /adminStorefrontMetadataMatch[\s\S]*?handleAdminStorefrontMetadataRequest/.test(router);
  }
  if (route === "/admin/runtime-settings") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/runtime-settings-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /saveWorkerRuntimeSettingsForAdmin/.test(source) &&
      /saveWorkerRuntimeSettingsForAdmin[\s\S]*?workerAdminMutation[\s\S]*?idempotencyKey/.test(bridge) &&
      /handleAdminRuntimeSettingsRequest[\s\S]*?executeIdempotently[\s\S]*?HyperdriveIdempotencyStore/.test(worker) &&
      /adminRuntimeSettingsMatch[\s\S]*?handleAdminRuntimeSettingsRequest/.test(router);
  }
  if (route === "/admin/offline-queue") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/offline-queue-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /saveWorkerOfflineQueueForAdmin/.test(source) &&
      /saveWorkerOfflineQueueForAdmin[\s\S]*?workerAdminMutation[\s\S]*?idempotencyKey/.test(bridge) &&
      /handleAdminOfflineQueueRequest[\s\S]*?executeIdempotently[\s\S]*?HyperdriveIdempotencyStore/.test(worker) &&
      /adminOfflineQueueMatch[\s\S]*?handleAdminOfflineQueueRequest/.test(router);
  }
  if (route === "/admin/devices" || route === "/admin/devices/{id}") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/devices-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /saveWorkerDeviceForAdmin/.test(source) &&
      /saveWorkerDeviceForAdmin[\s\S]*?workerAdminMutation[\s\S]*?idempotencyKey/.test(bridge) &&
      /handleAdminDevicesRequest[\s\S]*?executeIdempotently[\s\S]*?HyperdriveIdempotencyStore/.test(worker) &&
      /adminDevicesMatch|adminDeviceDetailMatch/.test(router);
  }
  if (route === "/admin/cms/pages") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/cms-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /saveWorkerCmsPageForAdmin/.test(source) &&
      /saveWorkerCmsPageForAdmin[\s\S]*?workerAdminMutation\([\s\S]*?input\.idempotencyKey/.test(bridge) &&
      /handleCmsAdminPageRequest[\s\S]*?executeIdempotently\([\s\S]*?HyperdriveIdempotencyStore/.test(worker) &&
      /cmsAdminCreateMatch[\s\S]*?handleCmsAdminPageRequest/.test(router);
  }
  if (route === "/admin/cms/pages/{id}") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/cms-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /saveWorkerCmsPageForAdmin|deleteWorkerCmsPageForAdmin/.test(source) &&
      /deleteWorkerCmsPageForAdmin[\s\S]*?workerAdminMutation[\s\S]*?input\.idempotencyKey/.test(bridge) &&
      /handleCmsAdminPageRequest[\s\S]*?executeIdempotently[\s\S]*?HyperdriveIdempotencyStore/.test(worker) &&
      /cmsAdminPageDetailMatch[\s\S]*?handleCmsAdminPageRequest/.test(router);
  }
  if (route === "/admin/cms/navigation") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/navigation-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /saveWorkerCmsNavigationForAdmin/.test(source) &&
      /saveWorkerCmsNavigationForAdmin[\s\S]*?workerAdminMutation\([\s\S]*?idempotencyKey/.test(bridge) &&
      /handleCmsAdminNavigationRequest[\s\S]*?executeIdempotently\([\s\S]*?HyperdriveIdempotencyStore/.test(worker) &&
      /cmsAdminNavigationMatch[\s\S]*?handleCmsAdminNavigationRequest/.test(router);
  }
  if (route === "/admin/cms/navigation/publish") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/navigation-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /publishWorkerCmsNavigationForAdmin/.test(source) &&
      /publishWorkerCmsNavigationForAdmin[\s\S]*?workerAdminMutation\([\s\S]*?input\.idempotencyKey/.test(bridge) &&
      /handleCmsAdminNavigationRequest[\s\S]*?executeIdempotently\([\s\S]*?HyperdriveIdempotencyStore/.test(worker) &&
      /cmsAdminNavigationPublishMatch[\s\S]*?handleCmsAdminNavigationRequest/.test(router);
  }
  if (route === "/admin/cms/announcement") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/announcement-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /saveWorkerCmsAnnouncementForAdmin|deleteWorkerCmsAnnouncementForAdmin/.test(source) &&
      /deleteWorkerCmsAnnouncementForAdmin[\s\S]*?workerAdminMutation[\s\S]*?idempotencyKey/.test(bridge) &&
      /handleCmsAdminAnnouncementRequest[\s\S]*?executeIdempotently[\s\S]*?HyperdriveIdempotencyStore/.test(worker) &&
      /cmsAdminAnnouncementMatch[\s\S]*?handleCmsAdminAnnouncementRequest/.test(router);
  }
  if (route === "/admin/cms/blog" || route === "/admin/cms/blog/{id}" || route === "/admin/cms/blog/bulk") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/blog-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /saveWorkerCmsBlogForAdmin|deleteWorkerCmsBlogForAdmin|bulkDeleteWorkerCmsBlogsForAdmin/.test(source) &&
      /saveWorkerCmsBlogForAdmin[\s\S]*?workerAdminMutation[\s\S]*?idempotencyKey/.test(bridge) &&
      /handleCmsAdminBlogRequest[\s\S]*?executeIdempotently[\s\S]*?HyperdriveIdempotencyStore/.test(worker) &&
      /cmsAdminBlogMatch[\s\S]*?handleCmsAdminBlogRequest/.test(router);
  }
  if (["/admin/cms/media", "/admin/catalog/media", "/admin/cms/media/{id}"].includes(route)) {
    if (!/proxyWorkerAdminRoute\(req,/.test(source) || !/Idempotency-Key/.test(source)) return false;
    const media = fs.readFileSync(path.join(root, "workers/backend/src/media-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /handleCmsAdminMediaUploadRequest[\s\S]*?executeIdempotently\([\s\S]*?HyperdriveIdempotencyStore/.test(media) &&
      /handleCmsAdminMediaDeleteRequest[\s\S]*?executeIdempotently\([\s\S]*?HyperdriveIdempotencyStore/.test(media) &&
      /handleCmsAdminMediaDetailRequest[\s\S]*?executeIdempotently\([\s\S]*?HyperdriveIdempotencyStore/.test(media) &&
      /cmsAdminMediaUploadMatch[\s\S]*?handleCmsAdminMediaUploadRequest/.test(router) &&
      /cmsAdminMediaDetailMatch[\s\S]*?handleCmsAdminMediaDetailRequest/.test(router);
  }
  if (route === "/admin/cms/category-content") {
    if (!/proxyWorkerAdminRoute\(request,/.test(source)) return false;
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/category-admin.ts"), "utf8");
    return /handleCmsAdminCategoryRequest[\s\S]*?executeIdempotently\([\s\S]*?scopedKey/.test(worker);
  }
  if (route === "/admin/chat-orders/{id}/status") {
    if (!/getIdempotencyKey\(request\)/.test(source) || !/updateWorkerChatOrderStatusForAdmin/.test(source)) return false;
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/chat-orders-admin.ts"), "utf8");
    return /updateWorkerChatOrderStatusForAdmin[\s\S]*?workerAdminMutation\([\s\S]*?input\.idempotencyKey/.test(bridge) &&
      /handleChatOrderStatus[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore\(app, 86_400\)/.test(worker);
  }
  if (route === "/admin/delivery-logistics/shipments") {
    if (!/request\.headers\.get\("Idempotency-Key"\)/.test(source) || !/createWorkerDeliveryShipmentForAdmin/.test(source)) return false;
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/delivery-admin.ts"), "utf8");
    return /createWorkerDeliveryShipmentForAdmin[\s\S]*?workerAdminMutation\([\s\S]*?input\.idempotencyKey/.test(bridge) &&
      /handleMutation[\s\S]*?request\.headers\.get\("Idempotency-Key"\)[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore\(database\)/.test(worker);
  }
  if (route === "/admin/pos/enterprise") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/pos-enterprise-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /handleAdminPosEnterpriseRequest/.test(worker) && /adminPosEnterpriseMatch/.test(router) && /fetchWorkerPosEnterpriseForAdmin|mutateWorkerPosEnterpriseForAdmin/.test(source);
  }
  if (route === "/admin/storefront-home") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/storefront-home-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /handleAdminStorefrontHomeRequest/.test(worker) && /adminStorefrontHomeMatch/.test(router) && /fetchWorkerStorefrontHomeForAdmin|mutateWorkerStorefrontHomeForAdmin/.test(source);
  }
  if (route === "/admin/shifts" || route === "/admin/shifts/{id}/close" || route === "/admin/shifts/{id}/reconciliation") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/pos-shifts-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /handleAdminPosShiftsRequest/.test(worker) && /adminPosShiftsMatch|adminPosShiftCloseMatch|adminPosShiftReconciliationMatch/.test(router) && /WorkerPosShift|WorkerPosShifts/.test(source);
  }
  if (route === "/admin/payments/{id}/mark-review") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/payment-mark-review-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /handleAdminPaymentMarkReviewRequest/.test(worker) && /adminPaymentMarkReviewMatch/.test(router) && /mutateWorkerPaymentMarkReviewForAdmin/.test(source);
  }
  if (route === "/admin/payments/{id}/retry") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/payment-retry-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /handleAdminPaymentRetryRequest/.test(worker) && /adminPaymentRetryMatch/.test(router) && /workerAdminMutation/.test(source);
  }
  if (route === "/admin/inventory/adjust") {
    if (!/req\.headers\.get\("Idempotency-Key"\)/.test(source) || !/adjustWorkerInventoryForAdmin/.test(source)) return false;
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/inventory-admin.ts"), "utf8");
    return /adjustWorkerInventoryForAdmin[\s\S]*?workerAdminMutation\([\s\S]*?input\.idempotencyKey/.test(bridge) &&
      /handleInventoryAdjustmentRequest[\s\S]*?request\.headers\.get\("Idempotency-Key"\)[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore\(database\)/.test(worker);
  }
  if (route === "/admin/invoices/{id}/lifecycle") {
    if (!/getIdempotencyKey\(request\)/.test(source) || !/updateWorkerInvoiceLifecycleForAdmin/.test(source)) return false;
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/invoice-admin.ts"), "utf8");
    return /updateWorkerInvoiceLifecycleForAdmin[\s\S]*?workerAdminMutation\([\s\S]*?input\.idempotencyKey/.test(bridge) &&
      /handleInvoiceLifecycleRequest[\s\S]*?idempotencyKey\(request\)[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore\(database\)/.test(worker);
  }
  if (route === "/admin/invoices") {
    if (!/getIdempotencyKey\(request\)/.test(source) || !/createWorkerInvoiceForAdmin/.test(source)) return false;
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/invoice-admin.ts"), "utf8");
    return /createWorkerInvoiceForAdmin[\s\S]*?workerAdminMutation\([\s\S]*?input\.idempotencyKey/.test(bridge) &&
      /handleInvoiceCreateRequest[\s\S]*?idempotencyKey\(request\)[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore\(appDatabase\)/.test(worker);
  }
  if (route === "/admin/orders/{orderId}/status") {
    if (!/request\.headers\.get\("Idempotency-Key"\)/.test(source) || !/updateWorkerOrderStatusForAdmin/.test(source)) return false;
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/admin-order-status.ts"), "utf8");
    return /updateWorkerOrderStatusForAdmin[\s\S]*?workerAdminMutation\([\s\S]*?input\.idempotencyKey/.test(bridge) &&
      /handleAdminOrderStatusRequest[\s\S]*?request\.headers\.get\("Idempotency-Key"\)[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore\(app\)/.test(worker);
  }
  if (route === "/admin/receipts") {
    if (!/getIdempotencyKey\(request\)/.test(source) || !/createWorkerReceiptForAdmin/.test(source)) return false;
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/receipt-admin.ts"), "utf8");
    return /createWorkerReceiptForAdmin[\s\S]*?workerAdminMutation\([\s\S]*?input\.idempotencyKey/.test(bridge) &&
      /handleAdminReceiptRequest[\s\S]*?const key = request\.headers\.get\("Idempotency-Key"\)[\s\S]*?executeIdempotently\(\s*new HyperdriveIdempotencyStore\(app\)/.test(worker);
  }
  if (route === "/admin/cms/category-content/sync-from-catalog") {
    if (!/proxyWorkerAdminRoute\(proxied,/.test(source) || !/Idempotency-Key/.test(source)) return false;
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/category-admin.ts"), "utf8");
    return /handleCmsAdminCategorySyncRequest[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore\(appDatabase\), scopedKey/.test(worker);
  }
  if (route === "/admin/inventory/reservations/{id}") {
    if (!/proxyWorkerAdminRoute\([\s\S]*?api\/admin\/inventory\/reservations/.test(source)) return false;
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/inventory-reservations-admin.ts"), "utf8");
    return /handleInventoryReservationMutationRequest[\s\S]*?executeIdempotently\([\s\S]*?scopedIdempotencyKey/.test(worker);
  }
  if (route === "/admin/inventory/reservations") {
    if (!/proxyWorkerAdminRoute\(request,\s*"\/api\/admin\/inventory\/reservations"[\s\S]*?adminInventoryReservation/.test(source)) return false;
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/inventory-reservations-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /handleInventoryReservationCollectionRequest[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore\(appDatabase\), scopedKey/.test(worker) &&
      /adminInventoryReservationCollectionMatch[\s\S]*?handleInventoryReservationCollectionRequest\(\s*request,\s*appDatabase,\s*commerceDatabase,\s*env,?\s*\)/.test(router);
  }
  if (route === "/admin/reviews/{id}") {
    const bridge = fs.readFileSync(path.join(root, "apps/web/src/lib/worker-admin-bridge.ts"), "utf8");
    if (!/saveWorkerAdminReviewForAdmin/.test(source) || !/saveWorkerAdminReviewForAdmin[\s\S]*?workerAdminMutation/.test(bridge)) return false;
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/reviews-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /handleAdminReviewsRequest[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore\(database\)/.test(worker) &&
      /adminReviewsMatch[\s\S]*?handleAdminReviewsRequest\(request, database,/.test(router);
  }
  if (route === "/admin/operator-notes") {
    const bridge = fs.readFileSync(path.join(root, "apps/web/src/lib/worker-admin-bridge.ts"), "utf8");
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/operator-notes-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /createWorkerAdminOperatorNoteForAdmin/.test(source) && /createWorkerAdminOperatorNoteForAdmin[\s\S]*?workerAdminMutation/.test(bridge) && /handleAdminOperatorNotesRequest[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore/.test(worker) && /adminOperatorNotesMatch[\s\S]*?handleAdminOperatorNotesRequest/.test(router);
  }
  if (route === "/admin/cms/forms/submissions/{id}") {
    const bridge = fs.readFileSync(path.join(root, "apps/web/src/lib/worker-admin-bridge.ts"), "utf8");
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/forms-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /updateWorkerCmsFormSubmissionForAdmin/.test(source) && /updateWorkerCmsFormSubmissionForAdmin[\s\S]*?workerAdminMutation/.test(bridge) && /handleCmsAdminFormSubmissionsRequest[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore/.test(worker) && /cmsAdminFormSubmissionsMatch[\s\S]*?handleCmsAdminFormSubmissionsRequest/.test(router);
  }
  if (route === "/admin/segments" || route === "/admin/segments/{id}/members") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/segments-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    const bridged = route === "/admin/segments"
      ? /createWorkerSegmentForAdmin/.test(source) && /createWorkerSegmentForAdmin[\s\S]*?workerAdminMutation/.test(bridge)
      : /addWorkerSegmentMembersForAdmin/.test(source) && /addWorkerSegmentMembersForAdmin[\s\S]*?workerAdminMutation/.test(bridge);
    return bridged && /handleAdminSegment(?:s|Members)Request[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore/.test(worker) && /adminSegmentsMatch[\s\S]*?handleAdminSegmentsRequest/.test(router);
  }
  if (route === "/admin/employees" || route === "/admin/employees/{id}" || route === "/admin/employees/{id}/pin") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/employees-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    const bridged = route === "/admin/employees"
      ? /createWorkerAdminEmployeeForAdmin/.test(source) && /createWorkerAdminEmployeeForAdmin[\s\S]*?workerAdminMutation/.test(bridge)
      : route.endsWith("/pin")
        ? /mutateWorkerEmployeePinForAdmin/.test(source) && /mutateWorkerEmployeePinForAdmin[\s\S]*?workerAdminMutation/.test(bridge)
        : /mutateWorkerEmployeesForAdmin/.test(source) && /mutateWorkerEmployeesForAdmin[\s\S]*?workerAdminMutation/.test(bridge);
    return bridged && /handleAdminEmployee(?:s|Pin)Request[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore/.test(worker) && /adminEmployeesMatch[\s\S]*?handleAdminEmployeesRequest/.test(router);
  }
  if (route === "/admin/campaigns" || route === "/admin/campaigns/{id}" || route === "/admin/campaigns/{id}/execute") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/campaigns-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    const bridged = route === "/admin/campaigns"
      ? /mutateWorkerCampaignForAdmin/.test(source) && /mutateWorkerCampaignForAdmin[\s\S]*?workerAdminMutation/.test(bridge)
      : /mutateWorkerCampaignForAdmin/.test(source) && /mutateWorkerCampaignForAdmin[\s\S]*?workerAdminMutation/.test(bridge);
    return bridged && /handleAdminCampaignsRequest[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore/.test(worker) && /adminCampaignsMatch[\s\S]*?handleAdminCampaignsRequest/.test(router);
  }
  if (route === "/admin/inventory/cycle-counts" || route === "/admin/inventory/cycle-counts/{id}") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/inventory-cycle-counts-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /proxyWorkerAdminRoute\(request,/.test(source) &&
      /executeIdempotently\(new HyperdriveIdempotencyStore\(app\)/.test(worker) &&
      /handleInventoryCycleCount(?:Collection|Mutation|Detail)Request/.test(worker) &&
      /adminInventoryCycleCount(?:Collection|Detail|Mutation)Match[\s\S]*?handleInventoryCycleCount/.test(router);
  }
  if (route === "/admin/inventory/purchase-orders" || route === "/admin/inventory/purchase-orders/{id}") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/inventory-purchase-orders-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /proxyWorkerAdminRoute\(request,/.test(source) &&
      /executeIdempotently\(new HyperdriveIdempotencyStore\(app\)/.test(worker) &&
      /handleInventoryPurchaseOrder(?:Collection|Mutation|Detail)Request/.test(worker) &&
      /adminInventoryPurchaseOrder(?:Collection|Detail|Mutation)Match[\s\S]*?handleInventoryPurchaseOrder/.test(router);
  }
  if (route === "/admin/inventory/transfers" || route === "/admin/inventory/transfers/{id}") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/inventory-transfers-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /proxyWorkerAdminRoute\(request,/.test(source) && /executeIdempotently\(new HyperdriveIdempotencyStore\(app\)/.test(worker) && /handleInventoryTransfer(?:Collection|Mutation|Detail)Request/.test(worker) && /adminInventoryTransfer(?:Collection|Detail|Mutation)Match[\s\S]*?handleInventoryTransfer/.test(router);
  }
  if (route === "/admin/orders/bulk-fulfill") {
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/fulfillment-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /Idempotency-Key/.test(source) &&
      /handleBulkFulfillmentRequest[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore\(app\)/.test(worker) &&
      /bulkFulfillmentMatch[\s\S]*?handleBulkFulfillmentRequest/.test(router);
  }
  if (route === "/admin/channels/events/{id}/process") {
    if (!/proxyWorkerAdminRoute\([\s\S]*?api\/admin\/channels\/events/.test(source)) return false;
    const worker = fs.readFileSync(path.join(root, "workers/backend/src/channel-events-admin.ts"), "utf8");
    const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
    return /handleChannelEventProcessRequest[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore\(database\)/.test(worker) &&
      /channelEventProcessMatch[\s\S]*?handleChannelEventProcessRequest\(\s*request,\s*database,\s*env/.test(router);
  }
  if (!route.startsWith("/admin/crm/nango") && !route.startsWith("/admin/payments/")) return false;
  if (!/proxyWorkerAdminRoute\(request,/.test(source)) return false;
  const router = fs.readFileSync(path.join(root, "workers/backend/src/router.ts"), "utf8");
  const worker = fs.readFileSync(path.join(root, "workers/backend/src/nango-admin.ts"), "utf8");
  return /nangoAdminMatch[\s\S]*?handleNangoAdminRequest\(request, database, env, kind\)/.test(router) &&
    /request\.headers\.get\("Idempotency-Key"\)[\s\S]*?executeIdempotently\(new HyperdriveIdempotencyStore\(database, 60\)/.test(worker);
}

function routeOperations() {
  const result = new Set();
  for (const file of walkRoutes(apiRoot)) {
    const source = fs.readFileSync(file, "utf8");
    const route = toApiPath(file);
    const mutations = [...source.matchAll(/export\s+(?:(?:async\s+)?function|const)\s+(POST|PUT|PATCH|DELETE)\b/g)].map((match) => match[1]);
    if (mutations.length && /^\/admin\//.test(route) && !/webhook/i.test(route) && !hasDurableReplayBoundary(route, source)) {
      throw new Error(`Mutation ${route} has no durable idempotency boundary.`);
    }
    if (!/^\/admin\//.test(route)) continue;
    for (const match of source.matchAll(/export\s+(?:(?:async\s+)?function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) {
      result.add(route + " " + match[1].toLowerCase());
    }
  }
  return result;
}

function documentOperations() {
if (/AdminOperation(Request|Response)/.test(documentSource)) {
  throw new Error("Generic admin OpenAPI request/response schemas are forbidden; every operation must have an operation-specific contract.");
}
const result = new Set();
  const paths = new Set();
  let inPaths = false;
  let currentPath = null;
  for (const line of documentSource.split(/\r?\n/)) {
    if (line === "paths:") {
      inPaths = true;
      continue;
    }
    if (inPaths && line === "components:") break;
    if (!inPaths) continue;
    const pathMatch = /^  (\/[^:]+):$/.exec(line);
    if (pathMatch) {
      currentPath = pathMatch[1];
      if (paths.has(currentPath)) throw new Error("Duplicate OpenAPI path key: " + currentPath);
      paths.add(currentPath);
      continue;
    }
    const methodMatch = /^    (get|post|put|patch|delete):$/.exec(line);
    if (methodMatch && currentPath && /^\/admin\//.test(currentPath)) {
      result.add(currentPath + " " + methodMatch[1]);
    }
  }
  return result;
}

const expected = routeOperations();
const actual = documentOperations();
const retiredAdminContracts = [
  "/admin/payments/provider-operation POST",
  "/admin/invoices/{id}/provider POST",
  "/admin/chat-orders/{id}/settle POST",
  "/admin/orders/export-jnt-csv POST",
];
const reintroducedRetiredContracts = retiredAdminContracts.filter(
  (operation) => expected.has(operation) || actual.has(operation),
);
if (reintroducedRetiredContracts.length) {
  throw new Error(
    "Retired legacy admin contracts must not be exposed until Worker parity exists:\n" +
      reintroducedRetiredContracts.join("\n"),
  );
}
if (/^      x-authentication-class: "unclassified"$/m.test(documentSource)) {
  throw new Error("Every API route needs an explicit reviewed authentication class; unclassified operations are not releasable.");
}
const missing = [...expected].filter((operation) => !actual.has(operation)).sort();
const extra = [...actual].filter((operation) => !expected.has(operation)).sort();
if (missing.length || extra.length) {
  if (missing.length) console.error("[admin-openapi] Missing operations:\n" + missing.join("\n"));
  if (extra.length) console.error("[admin-openapi] Extra operations:\n" + extra.join("\n"));
  process.exit(1);
}
const operationBlocks = documentSource.split(/^    (get|post|put|patch|delete):$/m).slice(1);
const authenticationClasses = new Map();
for (let index = 0; index < operationBlocks.length; index += 2) {
  const block = operationBlocks[index + 1] ?? "";
  if (!/operationId:\s*\S+/.test(block) || !/x-source-path:/.test(block) || !/x-source-sha256:/.test(block) || !/x-permission:/.test(block) || !/x-tenant-scoped:/.test(block) || !/x-idempotency-required:/.test(block) || !/x-idempotency-persisted:/.test(block) || !/x-runtime-statuses:\s*\[[^\]]+\]/.test(block)) {
    throw new Error("Every documented admin operation must declare operationId, source path/hash, permission, tenant scope, idempotency, and runtime-status metadata.");
  }
  const authClass = block.match(/^      x-authentication-class: "([a-z0-9-]+)"$/m)?.[1];
  const authStatus = block.match(/^      x-authentication-metadata-status: (explicit|source-inferred|not-documented)$/m)?.[1];
  if (!authClass || !authStatus) {
    throw new Error("Every API operation must disclose its authentication class and evidence status.");
  }
  authenticationClasses.set(authClass, (authenticationClasses.get(authClass) ?? 0) + 1);
  if (authClass === "unclassified" && authStatus !== "not-documented") {
    throw new Error("Unclassified API operations must not claim a verified authentication classification.");
  }
  const requiredSchemes = {
    "staff-session": "StaffSession",
    "customer-session": "CustomerSession",
    "cart-capability": "CartCapability",
    "cart-recovery-capability": ["CartCapability", "CartRecoveryToken"],
    "payment-attempt-capability": ["CartCapability", "CheckoutAttemptCapability"],
    "internal-secret": "InternalSecret",
    "signed-preview-capability": "PreviewCapability",
  }[authClass];
  if (requiredSchemes) {
    const schemes = Array.isArray(requiredSchemes) ? requiredSchemes : [requiredSchemes];
    for (const scheme of schemes) {
      if (!new RegExp(`^\\s+- ${scheme}: \\[\\]$`, "m").test(block)) {
        throw new Error(`${authClass} operations must declare the ${scheme} security scheme.`);
      }
    }
  }
  if (authClass === "customer-and-cart-capability" && !/^        - CustomerSession: \[\]\n          CartCapability: \[\]$/m.test(block)) {
    throw new Error("Combined customer/cart authorization must require both schemes, not either one.");
  }
  if (["public", "public-origin-protected", "oauth-callback", "local-e2e-credentials"].includes(authClass) && !/^      security: \[\]$/m.test(block)) {
    throw new Error(`${authClass} operations must explicitly declare that they have no authentication scheme.`);
  }
  if (/^      x-idempotency-required: true$/m.test(block) && !/^        - name: Idempotency-Key$/m.test(block) && !/webhook/i.test(block)) {
    throw new Error("Every non-webhook mutation must document its Idempotency-Key header.");
  }
  if (!/application\/problem\+json:[\s\S]*?\$ref: '#\/components\/schemas\/ProblemResponse'/.test(block)) {
    throw new Error("Every documented admin operation must reference ProblemResponse for declared errors.");
  }
}
const unresolvedSchemas = (documentSource.match(/^      x-contract-status: non-authoritative$/gm) ?? []).length;
const executableSchemas = (documentSource.match(/^      x-contract-status: executable$/gm) ?? []).length;
const heuristicSchemas = (documentSource.match(/^      x-contract-status: heuristic$/gm) ?? []).length;
const adminHeuristicSchemas = [...documentSource.matchAll(
  /^    [A-Za-z0-9_]+:\n(?:(?!^    [A-Za-z0-9_]+:$)[\s\S])*?description: .*Runtime source: apps\/web\/src\/app\/api\/admin\/.*\n(?:(?!^    [A-Za-z0-9_]+:$)[\s\S])*?x-contract-status: heuristic$/gm,
)];
if (adminHeuristicSchemas.length) {
  throw new Error(`Admin route schemas must be executable; heuristic entries: ${adminHeuristicSchemas.length}`);
}
console.log("[admin-openapi] " + actual.size + " route operations match the checked-in reference" +
  `; auth classes=${[...authenticationClasses].map(([name, count]) => `${name}:${count}`).join(",")}` +
  `; schemas executable=${executableSchemas}, heuristic=${heuristicSchemas}, unresolved=${unresolvedSchemas}`);
