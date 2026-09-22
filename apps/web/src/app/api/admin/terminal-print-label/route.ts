import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { terminalPrintLabelBodySchema } from "@/lib/terminal-print-schemas";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { callTerminalAgent, TerminalAgentError } from "@/lib/terminal-agent-client";
import { adminTerminalMutationResponseSchema } from "@/lib/admin-api-contracts";

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "pos:use")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }

  const parsedBody = await parseBoundedJson(req, 64 * 1024);
  if (parsedBody.tooLarge) return correlatedJson(cid, { error: "Payload too large" }, { status: 413 });
  const raw = parsedBody.valid ? parsedBody.value : null;
  const parsed = terminalPrintLabelBodySchema.safeParse(raw);
  if (!parsed.success) {
    return correlatedJson(
      cid,
      {
        error: "Invalid print label payload",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const result = await callTerminalAgent("/print-label", parsed.data);
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

export const POST = withAdminMutationIdempotency("/admin/terminal-print-label:POST", post);
