import type { NextRequest } from "next/server";

type Assessment = {
  tokenProperties?: { valid?: boolean; action?: string };
  riskAnalysis?: { score?: number };
};

export function isRecaptchaConfigured(): boolean {
  return Boolean(
    process.env.RECAPTCHA_PROJECT_ID?.trim() &&
      process.env.RECAPTCHA_ENTERPRISE_API_KEY?.trim() &&
      process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim(),
  );
}

export async function verifyRecaptchaAction(
  req: NextRequest | Request,
  token: unknown,
  action: string,
): Promise<boolean> {
  const projectId = process.env.RECAPTCHA_PROJECT_ID?.trim();
  const apiKey = process.env.RECAPTCHA_ENTERPRISE_API_KEY?.trim();
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
  if (!projectId || !apiKey || !siteKey) return false;
  if (typeof token !== "string" || token.length < 20 || token.length > 4096) return false;
  const response = await fetch(
    `https://recaptchaenterprise.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/assessments?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: {
          token,
          siteKey,
          expectedAction: action,
          userAgent: req.headers.get("user-agent") ?? undefined,
          userIpAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
        },
      }),
      cache: "no-store",
    },
  ).catch(() => null);
  if (!response?.ok) return false;
  const assessment = (await response.json().catch(() => null)) as Assessment | null;
  return Boolean(
    assessment?.tokenProperties?.valid &&
      assessment.tokenProperties.action?.toLowerCase() === action.toLowerCase() &&
      Number(assessment.riskAnalysis?.score ?? 0) >= 0.5,
  );
}
