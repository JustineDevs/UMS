import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import {
  listEmployees,
  createEmployee,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { parseBoundedJson } from "@/lib/bounded-request-body";

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSession("employees:read");
  if (!auth.ok) return auth.response;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const activeOnly = req.nextUrl.searchParams.get("active") === "true";
  const data = await listEmployees(sb, { activeOnly });
  return correlatedJson(cid, { data });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSession("employees:write");
  if (!auth.ok) return auth.response;
  const parsedBody = await parseBoundedJson(req, 32 * 1024);
  if (parsedBody.tooLarge) return correlatedJson(cid, { error: "Payload too large" }, { status: 413 });
  const body = parsedBody.valid && parsedBody.value && typeof parsedBody.value === "object" && !Array.isArray(parsedBody.value)
    ? parsedBody.value as Record<string, unknown>
    : {};
  if (!body.full_name) {
    return correlatedJson(cid, { error: "full_name is required" }, { status: 400 });
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const employee = await createEmployee(sb, body as Parameters<typeof createEmployee>[1]);
  return correlatedJson(cid, { data: employee }, { status: 201 });
}

export const POST = withAdminMutationIdempotency("/admin/employees:POST", post);
