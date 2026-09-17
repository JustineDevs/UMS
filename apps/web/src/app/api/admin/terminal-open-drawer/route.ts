import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { parseAdminJson, stepUpRequired } from "@/lib/admin-api-security";
import { verifyDeviceBinding } from "@/lib/admin-api-security";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { z } from "zod";

const drawerRequestSchema = z.object({
  device_id: z.string().min(1).max(128).optional(),
  reason: z.string().trim().min(1).max(200).optional(),
}).strict();

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "pos:use")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  if (!stepUpRequired("terminal.open_drawer", req)) {
    return correlatedJson(cid, { error: "Step-up authentication required" }, { status: 403 });
  }
  const bodyResult = await parseAdminJson(req, drawerRequestSchema);
  if (!bodyResult.ok) return correlatedJson(cid, { error: bodyResult.error }, { status: bodyResult.status });
  const deviceId = req.headers.get("x-device-id")?.trim() || bodyResult.data.device_id;
  if (process.env.TERMINAL_DEVICE_BINDING_REQUIRED === "true" && !deviceId) {
    return correlatedJson(cid, { error: "Device authentication required" }, { status: 403 });
  }
  if (process.env.TERMINAL_DEVICE_BINDING_REQUIRED === "true" && deviceId) {
    const sup = adminSupabaseOr503(cid);
    if ("response" in sup) return sup.response;
    if (!(await verifyDeviceBinding(sup.client, req, deviceId))) {
      return correlatedJson(cid, { error: "Device authentication failed" }, { status: 403 });
    }
  }
  const base =
    process.env.TERMINAL_AGENT_URL?.trim() ||
    process.env.NEXT_PUBLIC_TERMINAL_AGENT_URL?.trim() ||
    "http://127.0.0.1:17711";
  const bodyText = JSON.stringify({ ...bodyResult.data, device_id: deviceId });
  const secret = process.env.TERMINAL_AGENT_SECRET?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) {
    headers["X-Terminal-Agent-Secret"] = secret;
  }
  const res = await fetch(`${base.replace(/\/$/, "")}/open-drawer`, {
    method: "POST",
    headers,
    body: bodyText.length > 0 ? bodyText : "{}",
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    parsed = { raw: text };
  }
  return correlatedJson(cid, parsed, { status: res.status });
}

export const POST = withAdminMutationIdempotency("/admin/terminal-open-drawer:POST", post);
