import { NextRequest } from "next/server";
import {
  archiveCmsComponentDefinition,
  getCmsComponentDefinitionForOrganization,
  publishCmsComponentDefinition,
  saveCmsComponentDefinition,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";
import { cmsComponentActionSchema, cmsComponentWriteSchema } from "@/lib/cms-component-contract";
import type { CmsComponentDefinition } from "@universal-music-store/platform-data";

type Context = { params: Promise<{ id: string }> };

async function context(req: NextRequest, ctx: Context) {
  const requestId = getCorrelationId(req);
  const auth = await requireStaffApiSession("content:read");
  if (!auth.ok) return { requestId, response: auth.response } as const;
  const sup = adminSupabaseOr503(requestId);
  if ("response" in sup) return { requestId, response: sup.response } as const;
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) return { requestId, response: correlatedError(requestId, 403, "Forbidden", "FORBIDDEN") } as const;
  return { requestId, auth, sup, organization, id: (await ctx.params).id } as const;
}

export async function GET(req: NextRequest, ctx: Context) {
  const resolved = await context(req, ctx);
  if ("response" in resolved) return resolved.response;
  const row = await getCmsComponentDefinitionForOrganization(resolved.sup.client, resolved.organization.id, resolved.id);
  if (!row) return correlatedError(resolved.requestId, 404, "Not found", "NOT_FOUND");
  return correlatedJson(resolved.requestId, { data: row });
}

async function patch(req: NextRequest, ctx: Context) {
  const resolved = await context(req, ctx);
  if ("response" in resolved) return resolved.response;
  if (!resolved.auth.ok || !resolved.auth.session) return correlatedError(resolved.requestId, 401, "Unauthorized", "UNAUTHORIZED");
  const parsed = cmsComponentWriteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.definition.id !== resolved.id) return correlatedError(resolved.requestId, 400, "Invalid component definition", "VALIDATION_ERROR");
  const current = await getCmsComponentDefinitionForOrganization(resolved.sup.client, resolved.organization.id, resolved.id);
  if (!current || parsed.data.expectedVersion === undefined) return correlatedError(resolved.requestId, 409, "Component version required", "CONFLICT");
  const saved = await saveCmsComponentDefinition(resolved.sup.client, {
    organizationId: resolved.organization.id,
    componentKey: resolved.id,
    definition: parsed.data.definition as CmsComponentDefinition,
    expectedVersion: parsed.data.expectedVersion,
    actorId: resolved.auth.session.user?.email ?? undefined,
  });
  if (!saved) return correlatedError(resolved.requestId, 409, "Component changed; reload and retry", "CONFLICT");
  return correlatedJson(resolved.requestId, { data: saved });
}

async function post(req: NextRequest, ctx: Context) {
  const resolved = await context(req, ctx);
  if ("response" in resolved) return resolved.response;
  const parsed = cmsComponentActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return correlatedError(resolved.requestId, 400, "Invalid component action", "VALIDATION_ERROR");
  const saved = await publishCmsComponentDefinition(resolved.sup.client, resolved.organization.id, resolved.id, parsed.data.expectedVersion, resolved.auth.session?.user?.email ?? undefined);
  if (!saved) return correlatedError(resolved.requestId, 409, "Component changed; reload and retry", "CONFLICT");
  return correlatedJson(resolved.requestId, { data: saved });
}

async function del(req: NextRequest, ctx: Context) {
  const resolved = await context(req, ctx);
  if ("response" in resolved) return resolved.response;
  const version = Number(new URL(req.url).searchParams.get("version"));
  if (!Number.isInteger(version) || version < 1) return correlatedError(resolved.requestId, 400, "version required", "VALIDATION_ERROR");
  const archived = await archiveCmsComponentDefinition(resolved.sup.client, resolved.organization.id, resolved.id, version, resolved.auth.session?.user?.email ?? undefined);
  if (!archived) return correlatedError(resolved.requestId, 409, "Component changed; reload and retry", "CONFLICT");
  return correlatedJson(resolved.requestId, { data: { archived: true } });
}

export const PATCH = withAdminMutationIdempotency("/admin/cms/components/[id]:PATCH", patch);
export const POST = withAdminMutationIdempotency("/admin/cms/components/[id]:POST", post);
export const DELETE = withAdminMutationIdempotency("/admin/cms/components/[id]:DELETE", del);
