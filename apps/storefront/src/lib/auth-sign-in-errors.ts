/**
 * The sign-in page receives OAuth failures through the Supabase callback.
 * Codes vary by version; match case-insensitively.
 */
const HINTS: Record<string, string> = {
  Configuration:
    "The server is missing or misreading Supabase Auth environment variables. Configure SUPABASE_URL and the Supabase publishable/anon key, then add the exact app callback URL in Supabase Auth URL Configuration.",
  AccessDenied:
    "Google denied access or you cancelled. If the OAuth consent screen is in Testing, add your Google account under Test users, or publish the app.",
  OAuthSignin:
    "Google did not start the sign-in flow. Check Client ID and that Authorized JavaScript origins include this site’s origin (scheme + host + port).",
  OAuthCallback:
    "The Google callback failed. Add this app's exact /api/auth/callback URL to Supabase Auth URL Configuration and configure Google as a Supabase Auth provider.",
  OAuthCreateAccount:
    "Supabase could not link the Google account. Try again or clear site cookies for this domain.",
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
