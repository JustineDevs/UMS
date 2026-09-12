import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { terminalPrintBodySchema } from "@/lib/terminal-print-schemas";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";
import { parseBoundedJson } from "@/lib/bounded-request-body";

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedError(cid, 401, "Unauthorized", "UNAUTHORIZED");
  }
  if (!staffSessionAllows(session, "pos:use")) {
    return correlatedError(cid, 403, "Forbidden", "FORBIDDEN");
  }

  const parsedBody = await parseBoundedJson(req, 128 * 1024);
  if (parsedBody.tooLarge) return correlatedError(cid, 413, "Payload too large", "VALIDATION_ERROR");
  const raw = parsedBody.valid ? parsedBody.value : null;
  const parsed = terminalPrintBodySchema.safeParse(raw);
  if (!parsed.success) {
    return correlatedError(cid, 400, "Invalid receipt print payload", "VALIDATION_ERROR");
  }

  const base =
    process.env.TERMINAL_AGENT_URL?.trim() ||
    process.env.NEXT_PUBLIC_TERMINAL_AGENT_URL?.trim() ||
    "http://127.0.0.1:17711";
  const bodyText = JSON.stringify(parsed.data);
  const secret = process.env.TERMINAL_AGENT_SECRET?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) {
    headers["X-Terminal-Agent-Secret"] = secret;
  }
  const res = await fetch(`${base.replace(/\/$/, "")}/print-receipt`, {
    method: "POST",
    headers,
    body: bodyText,
  });
  const text = await res.text();
  let agentPayload: unknown = text;
  try {
    agentPayload = JSON.parse(text) as unknown;
  } catch {
    agentPayload = { raw: text };
  }
  return correlatedJson(cid, agentPayload, { status: res.status });
}

export const POST = withAdminMutationIdempotency("/admin/terminal-print:POST", post);
