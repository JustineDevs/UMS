import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { logAdminApiEvent } from "@/lib/admin-api-log";
import {
  getPlatformRuntimeSettings,
  mergePlatformRuntimeSettings,
  upsertPlatformRuntimeSettings,
  upsertStorefrontPublicMetadata,
  mergeStorefrontPublicMetadataPayload,
} from "@universal-music-store/platform-data";

export async function GET(req: Request) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("settings:read");
  if (!staff.ok) return tagResponse(staff.response, correlationId);
  const supabase = adminSupabaseOr503(correlationId);
  if ("response" in supabase) return supabase.response;
  const organization = await resolveStaffOrganization(supabase.client, staff.session.user?.email);
  if (!organization) return correlatedError(correlationId, 403, "Organization membership is not configured", "FORBIDDEN");
  try {
    const data = await getPlatformRuntimeSettings(supabase.client, organization.id);
    logAdminApiEvent({ route: "GET /api/admin/runtime-settings", correlationId, phase: "ok", detail: { organizationId: organization.id } });
    return correlatedJson(correlationId, { data });
  } catch {
    return correlatedError(correlationId, 503, "Runtime settings are unavailable", "SERVICE_UNAVAILABLE");
  }
}

async function put(req: Request) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("settings:write");
  if (!staff.ok) return tagResponse(staff.response, correlationId);
  const body = await parseBoundedJson(req, 64 * 1024);
  if (body.tooLarge) return correlatedError(correlationId, 413, "Payload too large", "BAD_REQUEST");
  if (!body.valid) return correlatedError(correlationId, 400, "Invalid JSON body", "BAD_REQUEST");
  const supabase = adminSupabaseOr503(correlationId);
  if ("response" in supabase) return supabase.response;
  const organization = await resolveStaffOrganization(supabase.client, staff.session.user?.email);
  if (!organization) return correlatedError(correlationId, 403, "Organization membership is not configured", "FORBIDDEN");
  try {
    const data = await upsertPlatformRuntimeSettings(
      supabase.client,
      organization.id,
      mergePlatformRuntimeSettings(body.value),
      staff.session.user?.email ?? "unknown",
    );
    await upsertStorefrontPublicMetadata(supabase.client, mergeStorefrontPublicMetadataPayload({
      storeName: data.storeName,
      supportEmail: data.supportEmail,
      supportPhone: data.supportPhone,
      shippingPolicyUrl: data.policyLinks.shipping,
      returnsPolicyUrl: data.policyLinks.returns,
      termsUrl: data.policyLinks.terms,
      privacyUrl: data.policyLinks.privacy,
      cookiesUrl: data.policyLinks.cookies,
      accessibilityUrl: data.policyLinks.accessibility,
      warrantyPdfUrl: data.policyLinks.warrantyPdf,
    }));
    logAdminApiEvent({ route: "PUT /api/admin/runtime-settings", correlationId, phase: "ok", detail: { organizationId: organization.id } });
    return correlatedJson(correlationId, { data });
  } catch {
    return correlatedError(correlationId, 503, "Runtime settings could not be saved", "SERVICE_UNAVAILABLE");
  }
}

export const PUT = withAdminMutationIdempotency("/admin/runtime-settings:PUT", put);
