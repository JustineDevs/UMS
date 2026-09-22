import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { terminalPrintBodySchema } from "@/lib/terminal-print-schemas";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { callTerminalAgent, TerminalAgentError } from "@/lib/terminal-agent-client";
import { adminTerminalMutationResponseSchema } from "@/lib/admin-api-contracts";

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

  try {
    const result = await callTerminalAgent("/print-receipt", parsed.data);
    if (result.status >= 200 && result.status < 300) {
      const validated = adminTerminalMutationResponseSchema.safeParse(result.payload);
      if (!validated.success) return correlatedError(cid, 502, "Terminal agent returned an invalid response", "SERVICE_UNAVAILABLE");
      return correlatedJson(cid, validated.data, { status: result.status });
    }
    return correlatedJson(cid, result.payload && typeof result.payload === "object" ? result.payload : { error: "Terminal agent request failed" }, { status: result.status });
  } catch (error) {
    const status = error instanceof TerminalAgentError ? error.status : 503;
    return correlatedError(cid, status, "Terminal agent is unavailable", "SERVICE_UNAVAILABLE");
  }
}

export const POST = withAdminMutationIdempotency("/admin/terminal-print:POST", post);
