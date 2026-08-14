import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { staffSessionAllows } from "@universal-music-store/database";
import { getStaffSession } from "@/lib/requireStaffSession";
import {
  createOperatorNote,
  listOperatorNotes,
} from "@/lib/admin-operator-notes";
import type { EntityWorkflowType } from "@/lib/admin-workflow";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";

export const dynamic = "force-dynamic";

const ENTITY_NOTE_PERMS: Record<
  EntityWorkflowType,
  { read: string; write: string }
> = {
  catalog_product: { read: "catalog:read", write: "catalog:write" },
  sales_order: { read: "orders:read", write: "orders:write" },
  inventory_adjustment: { read: "inventory:read", write: "inventory:write" },
  campaign: { read: "campaigns:read", write: "campaigns:write" },
  cms_page: { read: "content:read", write: "content:write" },
  chat_order: { read: "chat_orders:manage", write: "chat_orders:manage" },
};

function isEntityWorkflowType(v: string): v is EntityWorkflowType {
  return v in ENTITY_NOTE_PERMS;
}

export async function GET(req: Request) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(correlationId, { error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const entityType = url.searchParams.get("entity_type")?.trim() ?? "";
  const entityId = url.searchParams.get("entity_id")?.trim() ?? "";
  if (!entityType || !entityId) {
    return correlatedJson(
      correlationId,
      { error: "entity_type and entity_id query params are required" },
      { status: 400 },
    );
  }
  if (!isEntityWorkflowType(entityType)) {
    return correlatedJson(correlationId, { error: "Invalid entity_type" }, { status: 400 });
  }
  const readPerm = ENTITY_NOTE_PERMS[entityType].read;
  if (!staffSessionAllows(session, readPerm)) {
    return correlatedJson(correlationId, { error: "Forbidden" }, { status: 403 });
  }

  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) {
    return sup.response;
  }

  const notes = await listOperatorNotes(sup.client, entityType, entityId);
  return correlatedJson(correlationId, { notes });
}

async function post(req: Request) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user?.email) {
    return correlatedJson(correlationId, { error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const entityType = typeof body.entity_type === "string" ? body.entity_type : "";
  const entityId = typeof body.entity_id === "string" ? body.entity_id : "";
  const text = typeof body.body === "string" ? body.body : "";
  if (!entityType || !entityId || !text.trim()) {
    return correlatedJson(
      correlationId,
      { error: "entity_type, entity_id, and body are required" },
      { status: 400 },
    );
  }
  if (!isEntityWorkflowType(entityType)) {
    return correlatedJson(correlationId, { error: "Invalid entity_type" }, { status: 400 });
  }
  const writePerm = ENTITY_NOTE_PERMS[entityType].write;
  if (!staffSessionAllows(session, writePerm)) {
    return correlatedJson(correlationId, { error: "Forbidden" }, { status: 403 });
  }

  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) {
    return sup.response;
  }

  const row = await createOperatorNote(sup.client, {
    entityType,
    entityId,
    body: text,
    authorEmail: session.user.email,
  });
  if (!row) {
    return correlatedJson(correlationId, { error: "Unable to save note" }, { status: 502 });
  }
  return correlatedJson(correlationId, { id: row.id }, { status: 201 });
}

export const POST = withAdminMutationIdempotency("/admin/operator-notes:POST", post);
