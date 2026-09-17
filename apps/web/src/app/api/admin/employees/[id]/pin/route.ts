import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  setEmployeePin,
  verifyEmployeePin,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { parseAdminJson, stepUpRequired } from "@/lib/admin-api-security";
import { z } from "zod";

const pinSchema = z.object({ pin: z.string().regex(/^\d{4,8}$/) }).strict();

type Ctx = { params: Promise<{ id: string }> };

async function put(req: NextRequest, ctx: Ctx) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "employees:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  if (!stepUpRequired("employees.pin.write", req)) {
    return correlatedJson(cid, { error: "Step-up authentication required" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const parsed = await parseAdminJson(req, pinSchema);
  if (!parsed.ok) return correlatedJson(cid, { error: parsed.error }, { status: parsed.status });
  const { pin } = parsed.data;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  await setEmployeePin(sb, id, pin);
  return correlatedJson(cid, { success: true });
}

async function post(req: NextRequest, ctx: Ctx) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "employees:read")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const parsed = await parseAdminJson(req, pinSchema);
  if (!parsed.ok) return correlatedJson(cid, { error: parsed.error }, { status: parsed.status });
  const { pin } = parsed.data;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const valid = await verifyEmployeePin(sb, id, pin);
  return correlatedJson(cid, { valid });
}

export const PUT = withAdminMutationIdempotency("/admin/employees/[id]/pin:PUT", put);
export const POST = withAdminMutationIdempotency("/admin/employees/[id]/pin:POST", post);
