import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { terminalPrintLabelBodySchema } from "@/lib/terminal-print-schemas";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { parseBoundedJson } from "@/lib/bounded-request-body";

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

  const base =
    process.env.TERMINAL_AGENT_URL?.trim() ||
    process.env.NEXT_PUBLIC_TERMINAL_AGENT_URL?.trim() ||
    "http://127.0.0.1:17711";
  const secret = process.env.TERMINAL_AGENT_SECRET?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) {
    headers["X-Terminal-Agent-Secret"] = secret;
  }
  const res = await fetch(`${base.replace(/\/$/, "")}/print-label`, {
    method: "POST",
    headers,
    body: JSON.stringify(parsed.data),
  });
  const text = await res.text();
  let parsedOut: unknown = text;
  try {
    parsedOut = JSON.parse(text) as unknown;
  } catch {
    parsedOut = { raw: text };
  }
  return correlatedJson(cid, parsedOut, { status: res.status });
}

export const POST = withAdminMutationIdempotency("/admin/terminal-print-label:POST", post);
