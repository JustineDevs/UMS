/**
 * NextAuth redirects to `pages.signIn` with `?error=` when OAuth fails.
 * Codes vary by version; match case-insensitively.
 */
const HINTS: Record<string, string> = {
  Configuration:
    "The server is missing or misreading auth environment variables. On Vercel, set NEXTAUTH_URL (exact site URL, no trailing slash), NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET in Project Settings (the repo .env.local file is not deployed).",
  AccessDenied:
    "Google denied access or you cancelled. If the OAuth consent screen is in Testing, add your Google account under Test users, or publish the app.",
  OAuthSignin:
    "Google did not start the sign-in flow. Check Client ID and that Authorized JavaScript origins include this site’s origin (scheme + host + port).",
  OAuthCallback:
    "The callback from Google failed. Authorized redirect URI must be exactly NEXTAUTH_URL + /api/auth/callback/google (same http/https as NEXTAUTH_URL). If the secret was reset in Google Cloud, copy the new client secret into Vercel env.",
  OAuthCreateAccount:
    "NextAuth could not link the Google account. Try again or clear site cookies for this domain.",
  Callback:
    "An error ran inside the auth callback. Check deployment logs for the underlying exception.",
  Verification:
    "Email magic-link flow failed (unusual for Google button sign-in).",
  Default:
    "See the technical code below and verify Google Cloud OAuth + Vercel env vars match this deployment URL.",
};

export function describeAuthSignInError(code: string | undefined): {
  hint: string;
  codeLabel: string;
} {
  const raw = (code ?? "").trim();
  if (!raw) {
    return { hint: HINTS.Default, codeLabel: "(none)" };
  }
  const key = Object.keys(HINTS).find(
    (k) => k.toLowerCase() === raw.toLowerCase(),
  );
  const hint =
    key && key !== "Default" ? HINTS[key]! : `${HINTS.Default} Code: ${raw}.`;
  return { hint, codeLabel: raw };
}
