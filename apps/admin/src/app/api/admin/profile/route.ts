import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { parseBoundedJson } from "@/lib/bounded-request-body";

async function patch(req: NextRequest) {
  const cid = getCorrelationId(req);
  const staff = await requireStaffApiSession("settings:write");
  if (!staff.ok) {
    return tagResponse(staff.response, cid);
  }
  const session = staff.session;
  if (!session?.user?.email) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  const parsedBody = await parseBoundedJson(req, 16 * 1024);
  if (parsedBody.tooLarge) return correlatedJson(cid, { error: "Payload too large" }, { status: 413 });
  const raw = (parsedBody.valid && parsedBody.value && typeof parsedBody.value === "object" && !Array.isArray(parsedBody.value)
    ? parsedBody.value
    : {}) as { name?: unknown };
  const name =
    typeof raw.name === "string" ? raw.name.trim().slice(0, 200) : "";

  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;

  const email = session.user.email.trim().toLowerCase();
  const { error } = await sup.client
    .from("users")
    .update({
      name: name.length > 0 ? name : null,
      updated_at: new Date().toISOString(),
    })
    .eq("email", email);

  if (error) {
    return correlatedJson(cid, { error: error.message }, { status: 500 });
  }

  return correlatedJson(cid, { ok: true, name: name.length > 0 ? name : null });
}

export const PATCH = withAdminMutationIdempotency("/admin/profile:PATCH", patch);
