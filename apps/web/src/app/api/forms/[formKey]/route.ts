import { NextRequest } from "next/server";
import { handleCmsFormSubmissionRequest } from "@/lib/cms-form-route-handler";
import {
  isRecaptchaConfigured,
  verifyRecaptchaAction,
} from "@/lib/recaptcha-enterprise";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { isSameOriginMutation } from "@/lib/request-origin";
import { readResponseJson } from "@/lib/read-response-json";
import { cmsFormSubmissionResponseSchema } from "@/lib/admin-api-contracts";

const MAX_PUBLIC_FORM_BODY_BYTES = 16 * 1024;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ formKey: string }> },
) {
  if (!isSameOriginMutation(req)) {
    return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const { formKey } = await ctx.params;
  if (formKey === "contact") {
    if (!isRecaptchaConfigured()) {
      return Response.json({ error: "Security verification unavailable" }, { status: 503 });
    }
    const bounded = await parseBoundedJson(req.clone(), MAX_PUBLIC_FORM_BODY_BYTES);
    if (bounded.tooLarge) {
      return Response.json({ error: "Request body too large" }, { status: 413 });
    }
    const body = bounded.valid && bounded.value && typeof bounded.value === "object" && !Array.isArray(bounded.value)
      ? (bounded.value as { recaptchaToken?: unknown })
      : null;
    if (!(await verifyRecaptchaAction(req, body?.recaptchaToken, "contact"))) {
      return Response.json({ error: "Verification failed" }, { status: 400 });
    }
  }
  const response = await handleCmsFormSubmissionRequest(req, formKey);
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return response;
  const payload = await readResponseJson(response, null, { maxBytes: 16 * 1024 });
  const parsed = cmsFormSubmissionResponseSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: "Form submission returned an invalid response" }, { status: 502 });
  return Response.json(parsed.data, { status: response.status, headers: { "Cache-Control": "no-store" } });
}
