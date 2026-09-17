import {
  listCmsComponentDefinitionsForOrganization,
  mergeCmsComponentDefinitions,
  saveCmsComponentDefinition,
} from "@universal-music-store/platform-data";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { cmsComponentWriteSchema } from "@/lib/cms-component-contract";
import type { CmsComponentDefinition } from "@universal-music-store/platform-data";
import { parseBoundedJson } from "@/lib/bounded-request-body";

export async function GET(req: Request) {
  const requestId = getCorrelationId(req);
  const auth = await requireStaffApiSession("content:read");
  if (!auth.ok) {
    return auth.response.status === 401
      ? correlatedError(requestId, 401, "Unauthorized", "UNAUTHORIZED")
      : correlatedError(requestId, 403, "Forbidden", "FORBIDDEN");
  }

  const sup = adminSupabaseOr503(requestId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) return correlatedError(requestId, 403, "Forbidden", "FORBIDDEN");
  const stored = await listCmsComponentDefinitionsForOrganization(sup.client, organization.id);
  return correlatedJson(requestId, {
    data: mergeCmsComponentDefinitions(stored),
    meta: {
      version: Math.max(1, ...stored.map((row) => row.version)),
      contract: "cms-component-editor-v2",
      source: stored.length ? "organization" : "platform-data-defaults",
      records: stored.map((row) => ({ id: row.component_key, version: row.version, status: row.status })),
    },
  });
}

async function post(req: Request) {
  const requestId = getCorrelationId(req);
  const auth = await requireStaffApiSession("content:write");
  if (!auth.ok) return auth.response;
  const body = await parseBoundedJson(req, 512 * 1024);
  if (body.tooLarge) return correlatedError(requestId, 413, "Request body is too large", "BAD_REQUEST");
  const parsed = cmsComponentWriteSchema.safeParse(body.valid ? body.value : null);
  if (!parsed.success) return correlatedError(requestId, 400, "Invalid component definition", "VALIDATION_ERROR");
  const sup = adminSupabaseOr503(requestId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) return correlatedError(requestId, 403, "Forbidden", "FORBIDDEN");
  const existing = await listCmsComponentDefinitionsForOrganization(sup.client, organization.id);
  const current = existing.find((row) => row.component_key === parsed.data.definition.id);
  if (current && parsed.data.expectedVersion === undefined) {
    return correlatedError(requestId, 409, "Component version required", "CONFLICT");
  }
  const saved = await saveCmsComponentDefinition(sup.client, {
    organizationId: organization.id,
    componentKey: parsed.data.definition.id,
    definition: parsed.data.definition as CmsComponentDefinition,
    expectedVersion: parsed.data.expectedVersion,
    actorId: auth.session.user?.email ?? undefined,
  });
  if (!saved) return correlatedError(requestId, 409, "Component changed; reload and retry", "CONFLICT");
  return correlatedJson(requestId, { data: saved });
}

export const POST = withAdminMutationIdempotency("/admin/cms/components:POST", post);
