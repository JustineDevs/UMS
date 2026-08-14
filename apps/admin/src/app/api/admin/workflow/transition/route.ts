import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { staffSessionAllows } from "@universal-music-store/database";
import { getStaffSession } from "@/lib/requireStaffSession";
import {
  transitionEntityWorkflow,
  type EntityWorkflowType,
} from "@/lib/admin-workflow";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { jsonFromAdminOperationResult } from "@/lib/staff-api-operation";
import { insertStaffAuditLog } from "@/lib/staff-audit";
import { correlatedJson } from "@/lib/staff-api-response";
import { parseAdminJson } from "@/lib/admin-api-security";
import { z } from "zod";
import { resolveStaffOrganization } from "@/lib/staff-organization";

export const dynamic = "force-dynamic";

const ENTITY_PERMS: Record<EntityWorkflowType, string> = {
  catalog_product: "catalog:write",
  sales_order: "orders:write",
  inventory_adjustment: "inventory:write",
  campaign: "campaigns:write",
  cms_page: "content:write",
  chat_order: "chat_orders:manage",
};
const transitionSchema = z
  .object({
    entity_type: z.enum([
      "catalog_product",
      "sales_order",
      "inventory_adjustment",
      "campaign",
      "cms_page",
      "chat_order",
    ]),
    entity_id: z.string().trim().min(1).max(200),
    to_state: z.string().trim().min(1).max(40),
    notes: z.string().trim().max(2000).nullable().optional(),
    expected_updated_at: z.string().datetime().optional(),
  })
  .strict();

async function post(req: Request) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user?.email) {
    return correlatedJson(
      correlationId,
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const parsed = await parseAdminJson(req, transitionSchema);
  if (!parsed.ok)
    return correlatedJson(
      correlationId,
      { error: parsed.error },
      { status: parsed.status },
    );
  const {
    entity_type: entityType,
    entity_id: entityId,
    to_state: toState,
    notes,
    expected_updated_at: expectedUpdatedAt,
  } = parsed.data;

  const perm = ENTITY_PERMS[entityType];
  if (!perm) {
    return correlatedJson(
      correlationId,
      { error: "Invalid entity_type" },
      { status: 400 },
    );
  }
  if (!staffSessionAllows(session, perm)) {
    return correlatedJson(
      correlationId,
      { error: "Forbidden" },
      { status: 403 },
    );
  }

  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) {
    return sup.response;
  }
  const organization = await resolveStaffOrganization(
    sup.client,
    session.user.email,
  );
  if (!organization) {
    return correlatedJson(
      correlationId,
      { error: "Organization membership is not configured" },
      { status: 403 },
    );
  }

  const scopedTableByEntity: Partial<Record<EntityWorkflowType, string>> = {
    campaign: "campaigns",
    chat_order: "chat_order_intake",
    cms_page: "cms_pages",
    inventory_adjustment: "staff_catalog_inventory_audit",
  };
  const scopedTable = scopedTableByEntity[entityType];
  if (scopedTable) {
    const { data: entity, error } = await sup.client
      .from(scopedTable)
      .select("id")
      .eq("id", entityId)
      .eq("organization_id", organization.id)
      .maybeSingle();
    if (error) {
      console.error(JSON.stringify({
        scope: "workflow.entity_lookup",
        entity_type: entityType,
        correlation_id: correlationId,
        error: error.message,
      }));
      return correlatedJson(correlationId, { error: "Resource lookup unavailable" }, { status: 502 });
    }
    if (!entity) {
      return correlatedJson(correlationId, { error: "Resource not found" }, { status: 404 });
    }
  }

  const result = await transitionEntityWorkflow(sup.client, {
    organizationId: organization.id,
    entityType,
    entityId,
    toState,
    actorEmail: session.user.email,
    notes,
    expectedUpdatedAt,
  });

  if (!result.ok) {
    return jsonFromAdminOperationResult(correlationId, result, result.httpStatus);
  }

  await insertStaffAuditLog(sup.client, {
    actorEmail: session.user.email,
    action: "workflow.transition",
    resource: `${entityType}:${entityId}`,
    details: { to_state: toState },
  });

  return jsonFromAdminOperationResult(correlationId, result, 200);
}

export const POST = withAdminMutationIdempotency("/admin/workflow/transition:POST", post);
