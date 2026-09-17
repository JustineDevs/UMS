import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { z } from "zod";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { parseAdminJson } from "@/lib/admin-api-security";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { insertStaffAuditLog } from "@/lib/staff-audit";

const email = z.string().trim().toLowerCase().email().max(320);
const metadata = z.record(z.string(), z.unknown()).default({});
const isoDate = z.string().datetime({ offset: true });
const base = z.object({ kind: z.enum(["activity", "deal", "goal"]) }).strict();
const activitySchema = base.extend({
  kind: z.literal("activity"),
  customer_email: email,
  subject: z.string().trim().min(1).max(240),
  activity_type: z.enum(["email", "call", "meeting", "note", "task"]),
  body: z.string().max(10_000).nullable().optional(),
  occurred_at: isoDate.optional(),
  due_at: isoDate.nullable().optional(),
  completed: z.boolean().default(false),
  metadata,
});
const dealSchema = base.extend({
  kind: z.literal("deal"),
  customer_email: email,
  title: z.string().trim().min(1).max(240),
  stage: z.string().trim().min(1).max(40).default("qualified"),
  value: z.number().finite().min(0).max(100_000_000).default(0),
  probability: z.number().finite().min(0).max(1).default(0.25),
  expected_close_at: isoDate.nullable().optional(),
  source: z.string().trim().max(120).nullable().optional(),
  metadata,
});
const goalSchema = base.extend({
  kind: z.literal("goal"),
  period_start: z.string().date(),
  period_end: z.string().date(),
  target_value: z.number().finite().min(0).max(100_000_000),
  target_deals: z.number().int().min(0).max(1_000_000).default(0),
  metadata,
});
const operationSchema = z.discriminatedUnion("kind", [
  activitySchema,
  dealSchema,
  goalSchema,
]);
const idSchema = z.string().uuid();
const dealPatchSchema = z.object({
  kind: z.literal("deal"),
  id: idSchema,
  title: z.string().trim().min(1).max(240).optional(),
  stage: z.string().trim().min(1).max(40).optional(),
  value: z.number().finite().min(0).max(100_000_000).optional(),
  probability: z.number().finite().min(0).max(1).optional(),
  expected_close_at: isoDate.nullable().optional(),
  source: z.string().trim().max(120).nullable().optional(),
}).strict();
const activityPatchSchema = z.object({
  kind: z.literal("activity"),
  id: idSchema,
  subject: z.string().trim().min(1).max(240).optional(),
  body: z.string().max(10_000).nullable().optional(),
  activity_type: z.enum(["email", "call", "meeting", "note", "task"]).optional(),
  occurred_at: isoDate.optional(),
  due_at: isoDate.nullable().optional(),
  completed: z.boolean().optional(),
}).strict();
const patchSchema = z.discriminatedUnion("kind", [dealPatchSchema, activityPatchSchema]);
const deleteSchema = z.object({ kind: z.enum(["deal", "activity"]), id: idSchema }).strict();

function unauthorized(cid: string, status: 401 | 403) {
  return correlatedJson(
    cid,
    { error: status === 401 ? "Unauthorized" : "Forbidden" },
    { status },
  );
}

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return unauthorized(cid, 401);
  if (!staffSessionAllows(session, "crm:read")) return unauthorized(cid, 403);
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(
    sup.client,
    session.user.email,
  );
  if (!organization)
    return correlatedJson(
      cid,
      { error: "Organization membership is not configured" },
      { status: 403 },
    );
  const [activities, deals, goals] = await Promise.all([
    sup.client
      .from("crm_activities")
      .select(
        "id,customer_email,activity_type,subject,body,owner_email,occurred_at,due_at,completed_at,metadata,created_at,updated_at",
      )
      .eq("organization_id", organization.id)
      .order("occurred_at", { ascending: false })
      .limit(200),
    sup.client
      .from("crm_pipeline_deals")
      .select(
        "id,customer_email,title,stage,value,probability,owner_email,expected_close_at,source,metadata,created_at,updated_at",
      )
      .eq("organization_id", organization.id)
      .order("updated_at", { ascending: false })
      .limit(200),
    sup.client
      .from("crm_goals")
      .select(
        "id,owner_email,period_start,period_end,target_value,target_deals,metadata,created_at,updated_at",
      )
      .eq("organization_id", organization.id)
      .order("period_start", { ascending: false })
      .limit(100),
  ]);
  if (
    [activities, deals, goals].some(
      (result) =>
        result.error &&
        !/relation .* does not exist/i.test(result.error.message),
    )
  ) {
    return correlatedJson(
      cid,
      { error: "Unable to load CRM data", code: "CRM_READ_FAILED" },
      { status: 502 },
    );
  }
  return correlatedJson(cid, {
    data: {
      activities: activities.data ?? [],
      deals: deals.data ?? [],
      goals: goals.data ?? [],
    },
  });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user?.email) return unauthorized(cid, 401);
  if (!staffSessionAllows(session, "crm:write")) return unauthorized(cid, 403);
  const parsed = await parseAdminJson(req, operationSchema);
  if (!parsed.ok)
    return correlatedJson(
      cid,
      { error: parsed.error },
      { status: parsed.status },
    );
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(
    sup.client,
    session.user.email,
  );
  if (!organization)
    return correlatedJson(
      cid,
      { error: "Organization membership is not configured" },
      { status: 403 },
    );
  const actor = session.user.email.trim().toLowerCase();
  const body = parsed.data;
  let result;
  if (body.kind === "activity") {
    result = await sup.client
      .from("crm_activities")
      .insert({
        organization_id: organization.id,
        customer_email: body.customer_email,
        activity_type: body.activity_type,
        subject: body.subject,
        body: body.body ?? null,
        owner_email: actor,
        occurred_at: body.occurred_at ?? new Date().toISOString(),
        due_at: body.due_at ?? null,
        completed_at: body.completed ? new Date().toISOString() : null,
        metadata: body.metadata,
      })
      .select(
        "id,customer_email,activity_type,subject,body,owner_email,occurred_at,due_at,completed_at,metadata,created_at,updated_at",
      )
      .single();
  } else if (body.kind === "deal") {
    result = await sup.client
      .from("crm_pipeline_deals")
      .insert({
        organization_id: organization.id,
        customer_email: body.customer_email,
        title: body.title,
        stage: body.stage,
        value: body.value,
        probability: body.probability,
        owner_email: actor,
        expected_close_at: body.expected_close_at ?? null,
        source: body.source ?? null,
        metadata: body.metadata,
      })
      .select(
        "id,customer_email,title,stage,value,probability,owner_email,expected_close_at,source,metadata,created_at,updated_at",
      )
      .single();
  } else {
    if (body.period_end < body.period_start)
      return correlatedJson(
        cid,
        { error: "period_end must not precede period_start" },
        { status: 400 },
      );
    const goalValues = {
      organization_id: organization.id,
      owner_email: actor,
      period_start: body.period_start,
      period_end: body.period_end,
      target_value: body.target_value,
      target_deals: body.target_deals,
      metadata: body.metadata,
    };
    const existingGoal = await sup.client
      .from("crm_goals")
      .select("id")
      .eq("organization_id", organization.id)
      .eq("owner_email", actor)
      .eq("period_start", body.period_start)
      .eq("period_end", body.period_end)
      .maybeSingle();
    if (existingGoal.error)
      return correlatedJson(
        cid,
        { error: "Unable to save CRM record", code: "CRM_WRITE_FAILED" },
        { status: 502 },
      );
    result = existingGoal.data?.id
      ? await sup.client
          .from("crm_goals")
          .update(goalValues)
          .eq("id", existingGoal.data.id)
          .eq("organization_id", organization.id)
          .select(
            "id,owner_email,period_start,period_end,target_value,target_deals,metadata,created_at,updated_at",
          )
          .single()
      : await sup.client
          .from("crm_goals")
          .insert(goalValues)
          .select(
            "id,owner_email,period_start,period_end,target_value,target_deals,metadata,created_at,updated_at",
          )
          .single();
  }
  if (result.error)
    return correlatedJson(
      cid,
      { error: "Unable to save CRM record", code: "CRM_WRITE_FAILED" },
      { status: 502 },
    );
  return correlatedJson(cid, { data: result.data }, { status: 201 });
}

export const POST = withAdminMutationIdempotency("/admin/crm/operations:POST", post);

async function patch(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user?.email) return unauthorized(cid, 401);
  if (!staffSessionAllows(session, "crm:write")) return unauthorized(cid, 403);
  const parsed = await parseAdminJson(req, patchSchema);
  if (!parsed.ok) return correlatedJson(cid, { error: parsed.error }, { status: parsed.status });
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });

  const body = parsed.data;
  const changedFields = body.kind === "deal"
    ? [body.title, body.stage, body.value, body.probability, body.expected_close_at, body.source]
    : [body.subject, body.body, body.activity_type, body.occurred_at, body.due_at, body.completed];
  if (changedFields.every((value) => value === undefined)) {
    return correlatedJson(cid, { error: "At least one field is required" }, { status: 400 });
  }
  const table = body.kind === "deal" ? "crm_pipeline_deals" : "crm_activities";
  const values: Record<string, unknown> = {};
  if (body.kind === "deal") {
    for (const key of ["title", "stage", "value", "probability", "expected_close_at", "source"] as const) {
      if (body[key] !== undefined) values[key] = body[key];
    }
  } else {
    for (const key of ["subject", "body", "activity_type", "occurred_at", "due_at"] as const) {
      if (body[key] !== undefined) values[key] = body[key];
    }
    if (body.completed !== undefined) values.completed_at = body.completed ? new Date().toISOString() : null;
  }
  const result = await sup.client
    .from(table)
    .update(values)
    .eq("id", body.id)
    .eq("organization_id", organization.id)
    .select(body.kind === "deal"
      ? "id,customer_email,title,stage,value,probability,owner_email,expected_close_at,source,metadata,created_at,updated_at"
      : "id,customer_email,activity_type,subject,body,owner_email,occurred_at,due_at,completed_at,metadata,created_at,updated_at")
    .maybeSingle();
  if (result.error) return correlatedJson(cid, { error: "Unable to update CRM record", code: "CRM_WRITE_FAILED" }, { status: 502 });
  if (!result.data) return correlatedJson(cid, { error: "CRM record not found" }, { status: 404 });
  await insertStaffAuditLog(sup.client, {
    actorEmail: session.user.email.trim().toLowerCase(),
    action: body.kind === "deal" ? "crm.deal.update" : "crm.activity.update",
    resource: `${body.kind}:${body.id}`,
    details: { fields: Object.keys(values) },
  });
  return correlatedJson(cid, { data: result.data });
}

async function remove(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user?.email) return unauthorized(cid, 401);
  if (!staffSessionAllows(session, "crm:write")) return unauthorized(cid, 403);
  const parsed = await parseAdminJson(req, deleteSchema);
  if (!parsed.ok) return correlatedJson(cid, { error: parsed.error }, { status: parsed.status });
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const table = parsed.data.kind === "deal" ? "crm_pipeline_deals" : "crm_activities";
  const result = await sup.client
    .from(table)
    .delete()
    .eq("id", parsed.data.id)
    .eq("organization_id", organization.id)
    .select("id")
    .maybeSingle();
  if (result.error) return correlatedJson(cid, { error: "Unable to delete CRM record", code: "CRM_WRITE_FAILED" }, { status: 502 });
  if (!result.data) return correlatedJson(cid, { error: "CRM record not found" }, { status: 404 });
  await insertStaffAuditLog(sup.client, {
    actorEmail: session.user.email.trim().toLowerCase(),
    action: `crm.${parsed.data.kind}.delete`,
    resource: `${parsed.data.kind}:${parsed.data.id}`,
    details: {},
  });
  return correlatedJson(cid, { ok: true });
}

export const PATCH = withAdminMutationIdempotency("/admin/crm/operations:PATCH", patch);
export const DELETE = withAdminMutationIdempotency("/admin/crm/operations:DELETE", remove);
