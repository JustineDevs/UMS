type RecaptchaProvider = "enterprise" | "standard";

const READY_TIMEOUT_MS = 4_000;

export function recaptchaProvider(): RecaptchaProvider {
  return process.env.NEXT_PUBLIC_RECAPTCHA_PROVIDER?.trim().toLowerCase() === "standard"
    ? "standard"
    : "enterprise";
}

function isLocalRecaptchaBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.AUTH_DISABLE === "true" ||
      process.env.AUTH_DISABLED === "true" ||
      process.env.NEXT_PUBLIC_AUTH_DISABLE === "true" ||
      process.env.NEXT_PUBLIC_AUTH_DISABLED === "true")
  );
}

export function isLocalBrowserHost(): boolean {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

export async function getRecaptchaToken(action: string): Promise<string | null> {
  if (isLocalRecaptchaBypassEnabled()) return "local-recaptcha-bypass";
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
  if (!siteKey || typeof window === "undefined") return null;

  const grecaptcha = window.grecaptcha;
  if (!grecaptcha) return null;
  const provider = recaptchaProvider();
  const api = provider === "enterprise" ? grecaptcha.enterprise : grecaptcha;
  const readyCallback = api?.ready;
  const execute = api?.execute;
  if (typeof readyCallback !== "function" || typeof execute !== "function") return null;

  const ready = await new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };
    const timeout = setTimeout(() => finish(false), READY_TIMEOUT_MS);
    try {
      readyCallback.call(api, () => finish(true));
    } catch {
      finish(false);
    }
  });
  if (!ready) return null;

  try {
    const token = await Promise.race([
      execute.call(api, siteKey, { action }),
      new Promise<string | null>((resolve) =>
        setTimeout(() => resolve(null), READY_TIMEOUT_MS),
      ),
    ]);
    return typeof token === "string" && token.trim() ? token : null;
  } catch {
    return null;
  }
}
