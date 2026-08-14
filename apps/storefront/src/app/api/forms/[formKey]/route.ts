import { NextRequest } from "next/server";
import { handleCmsFormSubmissionRequest } from "@/lib/cms-form-route-handler";
import {
  isRecaptchaConfigured,
  verifyRecaptchaAction,
} from "@/lib/recaptcha-enterprise";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ formKey: string }> },
) {
  const { formKey } = await ctx.params;
  if (formKey === "contact") {
    if (!isRecaptchaConfigured()) {
      return Response.json({ error: "Security verification unavailable" }, { status: 503 });
    }
    const copy = req.clone();
    const body = (await copy.json().catch(() => null)) as { recaptchaToken?: unknown } | null;
    if (!(await verifyRecaptchaAction(req, body?.recaptchaToken, "contact"))) {
      return Response.json({ error: "Verification failed" }, { status: 400 });
    }
  }
  return handleCmsFormSubmissionRequest(req, formKey);
}
