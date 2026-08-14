import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  getEmployee,
  updateEmployee,
  deleteEmployee,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "employees:read")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const emp = await getEmployee(sb, id);
  if (!emp) return correlatedJson(cid, { error: "Not found" }, { status: 404 });
  return correlatedJson(cid, { data: emp });
}

async function patch(req: NextRequest, ctx: Ctx) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "employees:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = await req.json();
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const emp = await updateEmployee(sb, id, body);
  return correlatedJson(cid, { data: emp });
}

async function deleteHandler(req: NextRequest, ctx: Ctx) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "employees:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  try {
    await deleteEmployee(sb, id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isFk =
      /foreign key|violates|23503/i.test(msg) ||
      msg.toLowerCase().includes("referenced");
    return correlatedError(
      cid,
      isFk ? 409 : 502,
      isFk
        ? "This employee cannot be deleted while POS shifts, voids, or other records still reference them. Deactivate the employee instead, or remove related records first."
        : "Unable to delete employee.",
      isFk ? "CONFLICT" : "INTERNAL_ERROR",
    );
  }
  return correlatedJson(cid, { success: true });
}

export const PATCH = withAdminMutationIdempotency("/admin/employees/[id]:PATCH", patch);
export const DELETE = withAdminMutationIdempotency("/admin/employees/[id]:DELETE", deleteHandler);
