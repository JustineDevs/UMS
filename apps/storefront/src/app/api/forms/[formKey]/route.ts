import { NextRequest } from "next/server";
import { handleCmsFormSubmissionRequest } from "@/lib/cms-form-route-handler";
import {
  isRecaptchaConfigured,
  verifyRecaptchaAction,
} from "@/lib/recaptcha-enterprise";
import { parseBoundedJson } from "@/lib/bounded-request-body";

const MAX_PUBLIC_FORM_BODY_BYTES = 16 * 1024;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ formKey: string }> },
) {
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
  return handleCmsFormSubmissionRequest(req, formKey);
}
