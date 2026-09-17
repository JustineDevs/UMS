import type { NextRequest } from "next/server";

type Assessment = {
  tokenProperties?: { valid?: boolean; action?: string };
  riskAnalysis?: { score?: number };
};

type RecaptchaProvider = "enterprise" | "standard";

function recaptchaProvider(): RecaptchaProvider {
  // The public provider selects the browser script. Prefer it here too so a
  // stale server-only override cannot make the API verify a different token
  // type than the page generated.
  const configured = (process.env.NEXT_PUBLIC_RECAPTCHA_PROVIDER ?? process.env.RECAPTCHA_PROVIDER)
    ?.trim()
    .toLowerCase();
  return configured === "standard"
    ? "standard"
    : "enterprise";
}

function minimumRecaptchaScore(): number {
  const configured = Number(process.env.RECAPTCHA_MIN_SCORE);
  return Number.isFinite(configured) && configured >= 0 && configured <= 1 ? configured : 0.3;
}

export function isLocalRecaptchaBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.AUTH_DISABLE === "true" ||
      process.env.AUTH_DISABLED === "true" ||
      process.env.NEXT_PUBLIC_AUTH_DISABLE === "true" ||
      process.env.NEXT_PUBLIC_AUTH_DISABLED === "true")
  );
}

export function isRecaptchaConfigured(): boolean {
  if (isLocalRecaptchaBypassEnabled()) return true;
  if (recaptchaProvider() === "standard") {
    return Boolean(
      process.env.RECAPTCHA_SECRET_KEY?.trim() &&
        process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim(),
    );
  }
  const projectId = process.env.RECAPTCHA_PROJECT_ID?.trim();
  return Boolean(
    projectId &&
      /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) &&
      process.env.RECAPTCHA_ENTERPRISE_API_KEY?.trim() &&
      process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim(),
  );
}

export async function verifyRecaptchaAction(
  req: NextRequest | Request,
  token: unknown,
  action: string,
): Promise<boolean> {
  if (isLocalRecaptchaBypassEnabled()) return true;
  if (recaptchaProvider() === "standard") {
    const secret = process.env.RECAPTCHA_SECRET_KEY?.trim();
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
    if (!secret || !siteKey || typeof token !== "string" || token.length < 20 || token.length > 4096) return false;
    const body = new URLSearchParams({ secret, response: token });
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    }).catch(() => null);
    if (!response?.ok) return false;
    const assessment = (await response.json().catch(() => null)) as
      | { success?: boolean; action?: string; score?: number }
      | null;
    return Boolean(
      assessment?.success &&
        assessment.action?.toLowerCase() === action.toLowerCase() &&
        Number(assessment.score ?? 0) >= minimumRecaptchaScore(),
    );
  }
  const projectId = process.env.RECAPTCHA_PROJECT_ID?.trim();
  const apiKey = process.env.RECAPTCHA_ENTERPRISE_API_KEY?.trim();
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
  if (
    !projectId ||
    !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) ||
    !apiKey ||
    !siteKey
  ) return false;
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
      Number(assessment.riskAnalysis?.score ?? 0) >= minimumRecaptchaScore(),
  );
}
