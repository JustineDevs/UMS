import { readResponseJson } from "./read-response-json";
import { createHmac } from "node:crypto";
import { getAdminSession, type Session } from "./auth";
import { resolveStaffOrganization } from "./staff-organization";
import { tryCreateSupabaseClient } from "@universal-music-store/platform-data";

async function readWorkerAdminJson<T>(response: Response): Promise<T> {
  return readResponseJson(response, {} as T);
}

export type WorkerAdminOrder = {
  id: string;
  order_number: string;
  customer_id: string | null;
  email: string | null;
  status: string;
  channel: string;
  currency: string;
  grand_total: number;
  created_at: string;
};

export type WorkerAdminOrderDetail = WorkerAdminOrder & {
  subtotal: number;
  shipping_fee: number;
  metadata: Record<string, unknown>;
  order_items: Array<{
    id: string;
    sku_snapshot: string;
    product_name_snapshot: string;
    size_snapshot: string;
    color_snapshot: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  }>;
  shipments?: Array<{
    id: string;
    tracking_number?: string | null;
    carrier_slug?: string | null;
    status?: string | null;
    label_url?: string | null;
    shipped_at?: string | null;
  }>;
};

export type WorkerAdminPayment = {
  id: string;
  amount: number;
  currency_code: string;
  captured_amount?: number;
  refunded_amount?: number;
};

export type WorkerAdminInventoryRow = {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  available: number;
};

export type WorkerAdminCatalogProduct = {
  id: string;
  title: string;
  handle: string;
  status: string;
  thumbnail: string | null;
  variantCount: number;
  created_at: string;
  categories: Array<{ id?: string; name?: string }>;
  options: Array<{ title?: string }>;
  variants: Array<{ id?: string; sku?: string }>;
};

export type WorkerAdminCatalogProductDetail = {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  status: string;
  thumbnail: string | null;
  updated_at: string;
  metadata: Record<string, unknown>;
  images: Array<{ id?: string; url?: string; rank?: number | null }>;
  categories: Array<{ id?: string; name?: string; handle?: string }>;
  options: Array<{
    id?: string;
    title?: string;
    values?: Array<{ id?: string; value?: string }>;
  }>;
  variants: Array<{
    id: string;
    title?: string | null;
    sku?: string | null;
    barcode?: string | null;
    metadata?: Record<string, unknown>;
    options?: Array<{ id?: string; title?: string; value?: string }>;
    prices?: Array<{ amount?: number | string; currency_code?: string | null }>;
    inventory_quantity?: number | string | null;
  }>;
};

export type WorkerAdminCustomer = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  has_account: boolean;
  created_at: string;
};

export type WorkerAdminProductCategory = {
  id: string;
  name: string;
  handle: string;
};

function isWorkerAdminProductCategory(value: unknown): value is WorkerAdminProductCategory {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.name === "string" && typeof row.handle === "string";
}

function encodeTokenPart(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function fetchWorkerResponse(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const upstream = await fetch(input, init);
  const headers = new Headers(upstream.headers);
  // Undici transparently decompresses fetch bodies but may retain the upstream
  // encoding/length metadata; forwarding it makes browsers decompress JSON twice.
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  const body = [204, 205, 304].includes(upstream.status) ? null : upstream.body;
  return new Response(body, { status: upstream.status, statusText: upstream.statusText, headers });
}

/**
 * The Worker cannot safely accept a browser Supabase access token as an admin
 * token: staff role, permission, and tenant scope are server-side projections.
 * Mint a short-lived internal token after resolving those claims from the
 * authenticated server session and membership ledger.
 */
export async function createInternalWorkerAdminToken(session: Session): Promise<string | null> {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) return null;

  const email = session.user.email?.trim().toLowerCase();
  const userId = session.user.id?.trim();
  if (!email || !userId) return null;

  const supabase = tryCreateSupabaseClient();
  if (!supabase) return null;
  const organization = await resolveStaffOrganization(supabase, email);
  if (!organization) return null;

  const header = encodeTokenPart({ alg: "HS256", typ: "JWT" });
  const payload = encodeTokenPart({
    sub: userId,
    email,
    role: session.user.role ?? organization.role,
    permissions: session.user.permissions ?? [],
    organization_id: organization.id,
    iss: "uvs.internal",
    aud: "uvs-worker",
    exp: Math.floor(Date.now() / 1000) + 300,
  });
  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

async function workerAdminRequest(path: string, signal?: AbortSignal): Promise<Response | null> {
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  const session = await getAdminSession();
  if (!session) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const token = await createInternalWorkerAdminToken(session);
  if (!token) return null;
  return fetchWorkerResponse(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
    signal,
  });
}

async function workerAdminMutation(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body: Record<string, unknown>,
  idempotencyKey: string,
  extraHeaders?: Record<string, string>,
): Promise<Response | null> {
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  const session = await getAdminSession();
  if (!session) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const token = await createInternalWorkerAdminToken(session);
  if (!token) return null;
  return fetchWorkerResponse(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

async function workerAdminCsvMutation(path: string, body: string, idempotencyKey: string): Promise<Response | null> {
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  const session = await getAdminSession();
  if (!session) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const token = await createInternalWorkerAdminToken(session);
  if (!token) return null;
  return fetchWorkerResponse(`${base}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "text/csv", "Idempotency-Key": idempotencyKey }, body, cache: "no-store" });
}

export async function fetchWorkerPosEnterpriseForAdmin(): Promise<Response | null> { return workerAdminRequest("/api/admin/pos/enterprise"); }
export async function mutateWorkerPosEnterpriseForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/pos/enterprise", "POST", body, idempotencyKey); }
export async function fetchWorkerStorefrontHomeForAdmin(): Promise<Response | null> { return workerAdminRequest("/api/admin/storefront-home"); }
export async function mutateWorkerStorefrontHomeForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/storefront-home", "PUT", body, idempotencyKey); }
export async function fetchWorkerPosShiftsForAdmin(query = ""): Promise<Response | null> { return workerAdminRequest(`/api/admin/shifts${query}`); }
export async function mutateWorkerPosShiftsForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/shifts", "POST", body, idempotencyKey); }
export async function mutateWorkerPosShiftCloseForAdmin(id: string, body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation(`/api/admin/shifts/${encodeURIComponent(id)}/close`, "POST", body, idempotencyKey); }
export async function fetchWorkerPosShiftReconciliationForAdmin(id: string): Promise<Response | null> { return workerAdminRequest(`/api/admin/shifts/${encodeURIComponent(id)}/reconciliation`); }
export async function mutateWorkerPaymentMarkReviewForAdmin(id: string, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation(`/api/admin/payments/${encodeURIComponent(id)}/mark-review`, "POST", {}, idempotencyKey); }
export async function mutateWorkerPaymentRetryForAdmin(id: string, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation(`/api/admin/payments/${encodeURIComponent(id)}/retry`, "POST", {}, idempotencyKey); }
export async function fetchWorkerWorkflowEntitiesForAdmin(query = ""): Promise<Response | null> { return workerAdminRequest(`/api/admin/workflow/entities${query}`); }
export async function mutateWorkerWorkflowTransitionForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/workflow/transition", "POST", body, idempotencyKey); }
export async function fetchWorkerVoidsForAdmin(query = ""): Promise<Response | null> { return workerAdminRequest(`/api/admin/voids${query}`); }
export async function mutateWorkerVoidForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/voids", "POST", body, idempotencyKey); }
export async function fetchWorkerReconciliationForAdmin(query = ""): Promise<Response | null> { return workerAdminRequest(`/api/admin/reconciliation${query}`); }
export async function mutateWorkerPinApprovalForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/pin-approval", "POST", body, idempotencyKey); }

export async function fetchWorkerCmsPagesForAdmin(query: { locale?: string; slug?: string } = {}): Promise<Response | null> {
  const params = new URLSearchParams();
  if (query.locale) params.set("locale", query.locale);
  if (query.slug) params.set("slug", query.slug);
  return workerAdminRequest(`/api/admin/cms/pages${params.toString() ? `?${params}` : ""}`);
}

export async function fetchWorkerCmsNavigationForAdmin(): Promise<Response | null> {
  return workerAdminRequest("/api/admin/cms/navigation");
}

export async function saveWorkerCmsNavigationForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> {
  return workerAdminMutation("/api/admin/cms/navigation", "PUT", body, idempotencyKey);
}

export async function publishWorkerCmsNavigationForAdmin(idempotencyKey: string): Promise<Response | null> {
  return workerAdminMutation("/api/admin/cms/navigation/publish", "POST", {}, idempotencyKey);
}

export async function fetchWorkerCmsAnnouncementsForAdmin(): Promise<Response | null> {
  return workerAdminRequest("/api/admin/cms/announcement");
}

export async function saveWorkerCmsAnnouncementForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> {
  return workerAdminMutation("/api/admin/cms/announcement", "PUT", body, idempotencyKey);
}

export async function deleteWorkerCmsAnnouncementForAdmin(id: string, locale: string, idempotencyKey: string): Promise<Response | null> {
  return workerAdminMutation(`/api/admin/cms/announcement?id=${encodeURIComponent(id)}&locale=${encodeURIComponent(locale)}`, "DELETE", {}, idempotencyKey);
}

export async function fetchWorkerCmsBlogsForAdmin(): Promise<Response | null> {
  return workerAdminRequest("/api/admin/cms/blog");
}

export async function fetchWorkerCmsBlogExportForAdmin(query = ""): Promise<Response | null> {
  return workerAdminRequest(`/api/admin/cms/blog/export${query ? `?${query}` : ""}`);
}

export async function fetchWorkerCmsFormSubmissionsExportForAdmin(query = ""): Promise<Response | null> {
  return workerAdminRequest(`/api/admin/cms/forms/submissions/export${query ? `?${query}` : ""}`);
}

export async function fetchWorkerCmsFormSubmissionsForAdmin(query = ""): Promise<Response | null> { return workerAdminRequest(`/api/admin/cms/forms/submissions${query ? `?${query}` : ""}`); }
export async function updateWorkerCmsFormSubmissionForAdmin(id: string, body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation(`/api/admin/cms/forms/submissions/${encodeURIComponent(id)}`, "PATCH", body, idempotencyKey); }

export async function fetchWorkerCmsBlockPresetsForAdmin(query = ""): Promise<Response | null> { return workerAdminRequest(`/api/admin/cms/block-presets${query ? `?${query}` : ""}`); }
export async function createWorkerCmsBlockPresetForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/cms/block-presets", "POST", body, idempotencyKey); }
export async function deleteWorkerCmsBlockPresetForAdmin(id: string, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation(`/api/admin/cms/block-presets/${encodeURIComponent(id)}`, "DELETE", {}, idempotencyKey); }
export async function fetchWorkerCmsFormSettingsForAdmin(): Promise<Response | null> { return workerAdminRequest("/api/admin/cms/forms/settings"); }
export async function saveWorkerCmsFormSettingsForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/cms/forms/settings", "PUT", body, idempotencyKey); }
export async function fetchWorkerCmsExperimentsForAdmin(query = ""): Promise<Response | null> { return workerAdminRequest(`/api/admin/cms/experiments${query ? `?${query}` : ""}`); }
export async function saveWorkerCmsExperimentForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/cms/experiments", "POST", body, idempotencyKey); }
export async function updateWorkerCmsExperimentForAdmin(id: string, body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation(`/api/admin/cms/experiments/${encodeURIComponent(id)}`, "PUT", body, idempotencyKey); }
export async function fetchWorkerCmsComponentsForAdmin(): Promise<Response | null> { return workerAdminRequest("/api/admin/cms/components"); }
export async function fetchWorkerCmsComponentForAdmin(id: string): Promise<Response | null> { return workerAdminRequest(`/api/admin/cms/components/${encodeURIComponent(id)}`); }
export async function saveWorkerCmsComponentForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/cms/components", "POST", body, idempotencyKey); }
export async function updateWorkerCmsComponentForAdmin(id: string, body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation(`/api/admin/cms/components/${encodeURIComponent(id)}`, "PATCH", body, idempotencyKey); }
export async function publishWorkerCmsComponentForAdmin(id: string, body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation(`/api/admin/cms/components/${encodeURIComponent(id)}`, "POST", body, idempotencyKey); }
export async function archiveWorkerCmsComponentForAdmin(id: string, version: number, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation(`/api/admin/cms/components/${encodeURIComponent(id)}?version=${encodeURIComponent(String(version))}`, "DELETE", {}, idempotencyKey); }
export async function fetchWorkerCmsRedirectsForAdmin(query = ""): Promise<Response | null> { return workerAdminRequest(`/api/admin/cms/redirects${query ? `?${query}` : ""}`); }
export async function saveWorkerCmsRedirectForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/cms/redirects", "POST", body, idempotencyKey); }
export async function updateWorkerCmsRedirectForAdmin(id: string, body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation(`/api/admin/cms/redirects/${encodeURIComponent(id)}`, "PUT", body, idempotencyKey); }
export async function deleteWorkerCmsRedirectForAdmin(id: string, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation(`/api/admin/cms/redirects/${encodeURIComponent(id)}`, "DELETE", {}, idempotencyKey); }
export async function mutateWorkerCmsRedirectBulkForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/cms/redirects/bulk", "PATCH", body, idempotencyKey); }
export async function importWorkerCmsRedirectsForAdmin(body: string, idempotencyKey: string): Promise<Response | null> { return workerAdminCsvMutation("/api/admin/cms/redirects/import", body, idempotencyKey); }
export async function exportWorkerCmsRedirectsForAdmin(): Promise<Response | null> { return workerAdminRequest("/api/admin/cms/redirects/export"); }
export async function resolveWorkerCmsRedirectForAdmin(query: string): Promise<Response | null> { return workerAdminRequest(`/api/admin/cms/redirects/resolve?${query}`); }
export async function fetchWorkerDeliveryOperationsForAdmin(): Promise<Response | null> { return workerAdminRequest("/api/admin/delivery-logistics/operations"); }
export async function mutateWorkerDeliveryOperationForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/delivery-logistics/operations", "POST", body, idempotencyKey); }

export async function fetchWorkerPaymentHealthForAdmin(): Promise<Response | null> {
  return workerAdminRequest("/api/admin/payment-health");
}

export async function fetchWorkerPaymentAttemptsExportForAdmin(): Promise<Response | null> {
  return workerAdminRequest("/api/admin/payment-attempts/export");
}

export async function fetchWorkerAuditLogsForAdmin(query = ""): Promise<Response | null> {
  return workerAdminRequest(`/api/admin/audit-logs${query ? `?${query}` : ""}`);
}

export async function fetchWorkerPaymentRecoveryMetricsForAdmin(query = ""): Promise<Response | null> {
  return workerAdminRequest(`/api/admin/commerce-recovery-metrics${query ? `?${query}` : ""}`);
}

export async function fetchWorkerInventoryLedgerForAdmin(query = ""): Promise<Response | null> {
  return workerAdminRequest(`/api/admin/inventory/ledger${query ? `?${query}` : ""}`);
}

export async function fetchWorkerAdminReviewsForAdmin(query = ""): Promise<Response | null> {
  return workerAdminRequest(`/api/admin/reviews${query ? `?${query}` : ""}`);
}

export async function fetchWorkerAdminOperatorNotesForAdmin(query: string): Promise<Response | null> { return workerAdminRequest(`/api/admin/operator-notes?${query}`); }
export async function createWorkerAdminOperatorNoteForAdmin(query: string, body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation(`/api/admin/operator-notes?${query}`, "POST", body, idempotencyKey); }
export async function fetchWorkerCrmNotesForAdmin(query: string): Promise<Response | null> { return workerAdminRequest(`/api/admin/crm/notes?${query}`); }
export async function createWorkerCrmNoteForAdmin(query: string, body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation(`/api/admin/crm/notes?${query}`, "POST", body, idempotencyKey); }
export async function deleteWorkerCrmNoteForAdmin(id: string, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation(`/api/admin/crm/notes/${encodeURIComponent(id)}`, "DELETE", {}, idempotencyKey); }
export async function fetchWorkerCrmOperationsForAdmin(): Promise<Response | null> { return workerAdminRequest("/api/admin/crm/operations"); }
export async function mutateWorkerCrmOperationsForAdmin(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/crm/operations", method, body, idempotencyKey); }

export async function saveWorkerAdminReviewForAdmin(id: string, body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> {
  return workerAdminMutation(`/api/admin/reviews/${encodeURIComponent(id)}`, "PATCH", body, idempotencyKey);
}

export async function fetchWorkerAdminRolesForAdmin(): Promise<Response | null> {
  return workerAdminRequest("/api/admin/roles");
}

export async function fetchWorkerAdminTasksTodayForAdmin(): Promise<Response | null> {
  return workerAdminRequest("/api/admin/tasks/today");
}

export async function fetchWorkerAdminIntegrationHealthForAdmin(): Promise<Response | null> {
  return workerAdminRequest("/api/admin/integration-health");
}

export async function fetchWorkerAdminLoyaltyLookupForAdmin(query: string): Promise<Response | null> {
  return workerAdminRequest(`/api/admin/loyalty/lookup?${query}`);
}
export async function fetchWorkerAdminLoyaltyAccountsForAdmin(query = ""): Promise<Response | null> { return workerAdminRequest(`/api/admin/loyalty${query ? `?${query}` : ""}`); }
export async function createWorkerAdminLoyaltyAccountForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/loyalty", "POST", body, idempotencyKey); }
export async function mutateWorkerAdminLoyaltyPointsForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/loyalty/points", "POST", body, idempotencyKey); }
export async function fetchWorkerAdminLoyaltyRewardsForAdmin(): Promise<Response | null> { return workerAdminRequest("/api/admin/loyalty/rewards"); }
export async function createWorkerAdminLoyaltyRewardForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/loyalty/rewards", "POST", body, idempotencyKey); }

export async function fetchWorkerAdminPaymentsForAdmin(query = ""): Promise<Response | null> {
  return workerAdminRequest(`/api/admin/payments${query ? `?${query}` : ""}`);
}

export async function fetchWorkerAdminPaymentCapabilitiesForAdmin(): Promise<Response | null> {
  return workerAdminRequest("/api/admin/payments/capabilities");
}

export async function saveWorkerAdminProfileForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> {
  return workerAdminMutation("/api/admin/profile", "PATCH", body, idempotencyKey);
}

export async function fetchWorkerStorefrontMetadataForAdmin(): Promise<Response | null> { return workerAdminRequest("/api/admin/storefront-public-metadata"); }
export async function saveWorkerStorefrontMetadataForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/storefront-public-metadata", "PUT", body, idempotencyKey); }
export async function fetchWorkerRuntimeSettingsForAdmin(): Promise<Response | null> { return workerAdminRequest("/api/admin/runtime-settings"); }
export async function saveWorkerRuntimeSettingsForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/runtime-settings", "PUT", body, idempotencyKey); }
export async function fetchWorkerOfflineQueueForAdmin(query = ""): Promise<Response | null> { return workerAdminRequest(`/api/admin/offline-queue${query ? `?${query}` : ""}`); }
export async function saveWorkerOfflineQueueForAdmin(method: "POST" | "PATCH", body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/offline-queue", method, body, idempotencyKey); }
export async function fetchWorkerDevicesForAdmin(): Promise<Response | null> { return workerAdminRequest("/api/admin/devices"); }
export async function fetchWorkerSegmentsForAdmin(): Promise<Response | null> { return workerAdminRequest("/api/admin/segments"); }
export async function createWorkerSegmentForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/segments", "POST", body, idempotencyKey); }
export async function fetchWorkerSegmentMembersForAdmin(segmentId: string): Promise<Response | null> { return workerAdminRequest(`/api/admin/segments/${encodeURIComponent(segmentId)}/members`); }
export async function addWorkerSegmentMembersForAdmin(segmentId: string, body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation(`/api/admin/segments/${encodeURIComponent(segmentId)}/members`, "POST", body, idempotencyKey); }
export async function fetchWorkerEmployeesForAdmin(query = ""): Promise<Response | null> { return workerAdminRequest(`/api/admin/employees${query ? `?${query}` : ""}`); }
export async function fetchWorkerEmployeeForAdmin(employeeId: string): Promise<Response | null> { return workerAdminRequest(`/api/admin/employees/${encodeURIComponent(employeeId)}`); }
export async function mutateWorkerEmployeesForAdmin(path: string, method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation(path, method, body, idempotencyKey); }
export async function createWorkerAdminEmployeeForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return mutateWorkerEmployeesForAdmin("/api/admin/employees", "POST", body, idempotencyKey); }
export async function mutateWorkerEmployeePinForAdmin(path: string, method: "POST" | "PUT", body: Record<string, unknown>, idempotencyKey: string, stepUp: string | null): Promise<Response | null> { return workerAdminMutation(path, method, body, idempotencyKey, stepUp ? { "x-admin-step-up": stepUp } : undefined); }
export async function fetchWorkerCampaignsForAdmin(query = ""): Promise<Response | null> { return workerAdminRequest(`/api/admin/campaigns${query ? `?${query}` : ""}`); }
export async function fetchWorkerCampaignForAdmin(id: string): Promise<Response | null> { return workerAdminRequest(`/api/admin/campaigns/${encodeURIComponent(id)}`); }
export async function fetchWorkerInventoryCycleCountsForAdmin(query = ""): Promise<Response | null> { return workerAdminRequest(`/api/admin/inventory/cycle-counts${query ? `?${query}` : ""}`); }
export async function fetchWorkerInventoryCycleCountForAdmin(id: string): Promise<Response | null> { return workerAdminRequest(`/api/admin/inventory/cycle-counts/${encodeURIComponent(id)}`); }
export async function mutateWorkerInventoryCycleCountForAdmin(id: string, body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation(`/api/admin/inventory/cycle-counts/${encodeURIComponent(id)}`, "POST", body, idempotencyKey); }
export async function createWorkerInventoryCycleCountForAdmin(body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation("/api/admin/inventory/cycle-counts", "POST", body, idempotencyKey); }
export async function mutateWorkerCampaignForAdmin(path: string, method: "POST" | "PATCH", body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation(path, method, body, idempotencyKey); }
export async function saveWorkerDeviceForAdmin(path: string, method: "POST" | "PATCH", body: Record<string, unknown>, idempotencyKey: string): Promise<Response | null> { return workerAdminMutation(path, method, body, idempotencyKey); }

export async function fetchWorkerCustomerLoyaltyForStorefront(): Promise<Response | null> {
  return workerAdminRequest("/store/customers/me/loyalty");
}

export async function fetchWorkerCmsBlogDetailForAdmin(blogId: string): Promise<Response | null> {
  return workerAdminRequest(`/api/admin/cms/blog/${encodeURIComponent(blogId)}`);
}

export async function saveWorkerCmsBlogForAdmin(input: { blogId?: string; body: Record<string, unknown>; idempotencyKey: string }): Promise<Response | null> {
  return workerAdminMutation(input.blogId ? `/api/admin/cms/blog/${encodeURIComponent(input.blogId)}` : "/api/admin/cms/blog", input.blogId ? "PUT" : "POST", input.body, input.idempotencyKey);
}

export async function deleteWorkerCmsBlogForAdmin(blogId: string, idempotencyKey: string): Promise<Response | null> {
  return workerAdminMutation(`/api/admin/cms/blog/${encodeURIComponent(blogId)}`, "DELETE", {}, idempotencyKey);
}

export async function bulkDeleteWorkerCmsBlogsForAdmin(ids: string[], idempotencyKey: string): Promise<Response | null> {
  return workerAdminMutation("/api/admin/cms/blog/bulk", "POST", { ids }, idempotencyKey);
}

export async function fetchWorkerCmsPageDetailForAdmin(pageId: string): Promise<Response | null> {
  return workerAdminRequest(`/api/admin/cms/pages/${encodeURIComponent(pageId)}`);
}

export async function fetchWorkerCmsPageMutationsForAdmin(pageId: string): Promise<Response | null> {
  return workerAdminRequest(`/api/admin/cms/pages/${encodeURIComponent(pageId)}/mutations`);
}

export async function saveWorkerCmsPageForAdmin(input: {
  pageId?: string;
  body: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation(
    input.pageId ? `/api/admin/cms/pages/${encodeURIComponent(input.pageId)}` : "/api/admin/cms/pages",
    input.pageId ? "PUT" : "POST",
    input.body,
    input.idempotencyKey,
  );
}

export async function deleteWorkerCmsPageForAdmin(pageId: string, idempotencyKey: string): Promise<Response | null> {
  return workerAdminMutation(`/api/admin/cms/pages/${encodeURIComponent(pageId)}`, "DELETE", {}, idempotencyKey);
}

export async function adjustWorkerInventoryForAdmin(input: {
  productId: string;
  variantId: string;
  stockedQuantity?: number;
  delta?: number;
  expectedStockedQuantity?: number;
  locationId?: string;
  reason: string;
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation(
    "/api/admin/inventory",
    "POST",
    {
      productId: input.productId,
      variantId: input.variantId,
      ...(input.stockedQuantity === undefined ? {} : { stockedQuantity: input.stockedQuantity }),
      ...(input.delta === undefined ? {} : { delta: input.delta }),
      ...(input.expectedStockedQuantity === undefined ? {} : { expectedStockedQuantity: input.expectedStockedQuantity }),
      ...(input.locationId ? { locationId: input.locationId } : {}),
      reason: input.reason,
    },
    input.idempotencyKey,
  );
}

export async function fetchWorkerVariantInventoryForAdmin(input: {
  variantId?: string;
  inventoryItemId?: string;
  locationId?: string;
}): Promise<{ productId: string; variantId: string; inventoryItemId: string; locationId: string | null; stockedQuantity: number; reservedQuantity: number; availableQuantity: number } | null> {
  try {
    if (Boolean(input.variantId) === Boolean(input.inventoryItemId)) return null;
    const query = new URLSearchParams(input.variantId
      ? { variantId: input.variantId }
      : { inventoryItemId: input.inventoryItemId! });
    if (input.locationId) query.set("locationId", input.locationId);
    const response = await workerAdminRequest(`/api/admin/inventory?${query.toString()}`);
    if (!response?.ok) return null;
    const payload = await readWorkerAdminJson<{ data?: Record<string, unknown> }>(response);
    const data = payload.data;
    if (!data || typeof data.productId !== "string" || typeof data.variantId !== "string" || typeof data.inventoryItemId !== "string") return null;
    const stockedQuantity = Number(data.stockedQuantity);
    const reservedQuantity = Number(data.reservedQuantity);
    const availableQuantity = Number(data.availableQuantity);
    if (![stockedQuantity, reservedQuantity, availableQuantity].every(Number.isSafeInteger)) return null;
    return {
      productId: data.productId,
      variantId: data.variantId,
      inventoryItemId: data.inventoryItemId,
      locationId: typeof data.locationId === "string" ? data.locationId : null,
      stockedQuantity,
      reservedQuantity,
      availableQuantity,
    };
  } catch {
    return null;
  }
}

export async function fetchWorkerProductCategoriesForAdmin(): Promise<WorkerAdminProductCategory[] | null> {
  try {
    const response = await workerAdminRequest("/api/admin/catalog/categories");
    if (!response?.ok) return null;
    const payload = await readWorkerAdminJson<{ categories?: unknown }>(response);
    return Array.isArray(payload.categories)
      ? payload.categories.filter(isWorkerAdminProductCategory)
      : [];
  } catch {
    return null;
  }
}

export async function fetchWorkerPromotionCodesForAdmin(): Promise<string[] | null> {
  try {
    const response = await workerAdminRequest("/api/admin/promotions/codes");
    if (!response?.ok) return null;
    const payload = await readWorkerAdminJson<{ codes?: unknown }>(response);
    return Array.isArray(payload.codes)
      ? payload.codes.filter((code): code is string => typeof code === "string")
      : null;
  } catch {
    return null;
  }
}

export async function createWorkerProductCategoryForAdmin(input: {
  name: string;
  handle?: string;
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation(
    "/api/admin/catalog/categories",
    "POST",
    { name: input.name, ...(input.handle ? { handle: input.handle } : {}) },
    input.idempotencyKey,
  );
}

export async function deleteWorkerCatalogProductForAdmin(input: {
  productId: string;
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation(
    `/api/admin/catalog/products/${encodeURIComponent(input.productId)}`,
    "DELETE",
    {},
    input.idempotencyKey,
  );
}

export async function createWorkerCatalogProductForAdmin(input: {
  body: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation("/api/admin/catalog/products", "POST", input.body, input.idempotencyKey);
}

export async function updateWorkerCatalogProductForAdmin(input: {
  productId: string;
  body: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation(`/api/admin/catalog/products/${encodeURIComponent(input.productId)}`, "PATCH", input.body, input.idempotencyKey);
}

export async function updateWorkerOrderStatusForAdmin(input: {
  orderId: string;
  status: string;
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation(
    `/api/admin/orders/${encodeURIComponent(input.orderId)}/status`,
    "PATCH",
    { status: input.status },
    input.idempotencyKey,
  );
}

export async function fetchWorkerDeliveryShipmentsForAdmin(): Promise<Response | null> {
  return workerAdminRequest("/api/admin/delivery-logistics/shipments");
}

export async function createWorkerDeliveryShipmentForAdmin(input: {
  body: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation(
    "/api/admin/delivery-logistics/shipments",
    "POST",
    input.body,
    input.idempotencyKey,
  );
}

export async function syncWorkerCatalogProviderForAdmin(input: {
  body: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation(
    "/api/admin/catalog/provider-sync",
    "POST",
    { ...input.body, idempotencyKey: input.idempotencyKey },
    input.idempotencyKey,
  );
}

export async function fetchWorkerInvoicesForAdmin(): Promise<Response | null> {
  return workerAdminRequest("/api/admin/invoices");
}

export async function createWorkerInvoiceForAdmin(input: {
  body: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation("/api/admin/invoices", "POST", input.body, input.idempotencyKey);
}

export async function updateWorkerInvoiceLifecycleForAdmin(input: {
  invoiceId: string;
  action: "retry" | "void" | "refund";
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation(
    `/api/admin/invoices/${encodeURIComponent(input.invoiceId)}/lifecycle`,
    "POST",
    { action: input.action },
    input.idempotencyKey,
  );
}

export async function fetchWorkerReceiptForAdmin(orderId: string): Promise<Response | null> {
  return workerAdminRequest(`/api/admin/receipts?order_id=${encodeURIComponent(orderId)}`);
}

export type WorkerChatOrder = {
  id: string;
  source: string;
  status: string;
  phone: string | null;
  address: string | null;
  raw_text: string | null;
  commerce_cart_id: string | null;
  commerce_order_id: string | null;
  commerce_order_display_id: string | null;
  commerce_payment_status: string | null;
  payment_provider: string | null;
  payment_external_id: string | null;
  payment_status: string | null;
  created_at: string;
};

export async function fetchWorkerChatOrdersForAdmin(limit = 80): Promise<WorkerChatOrder[] | null> {
  try {
    const response = await workerAdminRequest(`/api/admin/chat-orders?limit=${encodeURIComponent(String(limit))}`);
    if (!response?.ok) return null;
    const payload = await readWorkerAdminJson<{ rows?: unknown }>(response);
    return Array.isArray(payload.rows) ? payload.rows as WorkerChatOrder[] : [];
  } catch {
    return null;
  }
}

export async function createWorkerChatOrderForAdmin(input: {
  body: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation("/api/integrations/chat-orders/intake", "POST", input.body, input.idempotencyKey);
}

export async function updateWorkerChatOrderStatusForAdmin(input: {
  ticketId: string;
  status: "processing" | "cancelled";
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation(`/api/admin/chat-orders/${encodeURIComponent(input.ticketId)}/status`, "POST", { status: input.status }, input.idempotencyKey);
}

export async function createWorkerReceiptForAdmin(input: {
  orderId: string;
  send: boolean;
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation(
    "/api/admin/receipts",
    "POST",
    { order_id: input.orderId, send: input.send },
    input.idempotencyKey,
  );
}

export async function fetchWorkerOrdersForAdmin(limit = 50, offset = 0, customerId?: string): Promise<{
  orders: WorkerAdminOrder[];
  total: number;
  commerceUnavailable?: boolean;
}> {
  try {
    const customerQuery = customerId ? `&customer_id=${encodeURIComponent(customerId)}` : "";
    const response = await workerAdminRequest(`/api/admin/orders?limit=${limit}&offset=${offset}${customerQuery}`);
    if (!response?.ok) return { orders: [], total: 0, commerceUnavailable: true };
    const payload = await readWorkerAdminJson<{ orders?: WorkerAdminOrder[]; total?: number }>(response);
    return {
      orders: Array.isArray(payload.orders) ? payload.orders : [],
      total: typeof payload.total === "number" ? payload.total : 0,
    };
  } catch {
    return { orders: [], total: 0, commerceUnavailable: true };
  }
}

export async function fetchWorkerOrderDetailForAdmin(orderId: string): Promise<{
  order: WorkerAdminOrderDetail;
  payments: WorkerAdminPayment[];
} | null> {
  try {
    const response = await workerAdminRequest(`/api/admin/orders/${encodeURIComponent(orderId)}`);
    if (!response?.ok) return null;
    const payload = await readWorkerAdminJson<{
      order?: WorkerAdminOrderDetail;
      payments?: WorkerAdminPayment[];
    }>(response);
    return payload.order ? { order: payload.order, payments: Array.isArray(payload.payments) ? payload.payments : [] } : null;
  } catch {
    return null;
  }
}

export async function fetchWorkerCustomersForAdmin(limit = 100): Promise<WorkerAdminCustomer[]> {
  try {
    const response = await workerAdminRequest(`/api/admin/customers?limit=${Math.min(100, Math.max(1, limit))}&offset=0`);
    if (!response?.ok) return [];
    const payload = await readWorkerAdminJson<{ customers?: WorkerAdminCustomer[] }>(response);
    return Array.isArray(payload.customers) ? payload.customers : [];
  } catch {
    return [];
  }
}

export async function fetchWorkerCustomerById(id: string): Promise<WorkerAdminCustomer | null> {
  try {
    const response = await workerAdminRequest(`/api/admin/customers/${encodeURIComponent(id)}`);
    if (!response?.ok) return null;
    const payload = await readWorkerAdminJson<{ customer?: WorkerAdminCustomer }>(response);
    return payload.customer ?? null;
  } catch {
    return null;
  }
}

export async function fetchWorkerInventoryPage(opts: { limit: number; offset: number; signal?: AbortSignal }): Promise<{
  rows: WorkerAdminInventoryRow[];
  total: number;
}> {
  try {
    const response = await workerAdminRequest(`/api/admin/inventory?limit=${opts.limit}&offset=${opts.offset}`, opts.signal);
    if (!response?.ok) return { rows: [], total: 0 };
    const payload = await readWorkerAdminJson<{ rows?: WorkerAdminInventoryRow[]; total?: number }>(response);
    return {
      rows: Array.isArray(payload.rows) ? payload.rows : [],
      total: typeof payload.total === "number" ? payload.total : 0,
    };
  } catch {
    return { rows: [], total: 0 };
  }
}

export async function fetchWorkerCatalogProductsForAdmin(opts: {
  limit: number;
  offset: number;
  q?: string;
  status?: string;
  order?: string;
}): Promise<{
  products: WorkerAdminCatalogProduct[];
  count: number;
  commerceUnavailable?: boolean;
}> {
  try {
    const qs = new URLSearchParams({
      limit: String(opts.limit),
      offset: String(opts.offset),
    });
    if (opts.q?.trim()) qs.set("q", opts.q.trim());
    if (opts.status) qs.set("status", opts.status);
    if (opts.order) qs.set("order", opts.order);
    const response = await workerAdminRequest(`/api/admin/catalog/products?${qs.toString()}`);
    if (!response?.ok) return { products: [], count: 0, commerceUnavailable: true };
    const payload = await readWorkerAdminJson<{
      products?: WorkerAdminCatalogProduct[];
      count?: number;
    }>(response);
    return {
      products: Array.isArray(payload.products) ? payload.products : [],
      count: typeof payload.count === "number" ? payload.count : 0,
    };
  } catch {
    return { products: [], count: 0, commerceUnavailable: true };
  }
}

export async function fetchWorkerCatalogProductDetailForAdmin(
  productId: string,
): Promise<WorkerAdminCatalogProductDetail | null> {
  try {
    const response = await workerAdminRequest(
      `/api/admin/catalog/products/${encodeURIComponent(productId)}`,
    );
    if (!response?.ok) return null;
    const payload = await readWorkerAdminJson<{
      product?: WorkerAdminCatalogProductDetail;
    }>(response);
    return payload.product ?? null;
  } catch {
    return null;
  }
}
