/** Normalizes email for comparison with `ADMIN_ALLOWED_EMAILS` (case-insensitive). */
function normalizeAdminEmailKey(email: string): string {
  return email.trim().toLowerCase();
}

/** Comma-separated list from env (same source as Google admin promotion). */
function parseAdminAllowedEmailList(): string[] {
  return (
    process.env.ADMIN_ALLOWED_EMAILS?.split(",")
      .map((s) => normalizeAdminEmailKey(s))
      .filter(Boolean) ?? []
  );
}

/** First entry: used for E2E credentials default email (single list, no extra env). */
export function firstAdminAllowedEmail(): string | undefined {
  const list = parseAdminAllowedEmailList();
  return list[0];
}

/**
 * Guide demos (`/guide-demos/*`) are restricted to addresses listed in `ADMIN_ALLOWED_EMAILS`
 * (same list used to promote Google accounts to staff). If the list is empty, access is denied
 * until you configure at least one allowed email.
 */
export function isEmailAllowedForGuideDemos(email: string | null | undefined): boolean {
  const list = parseAdminAllowedEmailList();
  const key = email ? normalizeAdminEmailKey(email) : "";
  if (!key) return false;
  if (list.length === 0) return false;
  return list.includes(key);
}

/**
 * Registers the E2E Credentials provider for a local E2E process. Production
 * mode is allowed only with the explicit local marker so stable browser proof
 * can avoid development hot-reload churn; Vercel is always denied.
 */
export function isAdminE2eCredentialsConfigured(): boolean {
  return (
    process.env.VERCEL !== "1" &&
    (process.env.NODE_ENV === "development" || process.env.UVS_E2E_LOCAL === "1") &&
    Boolean(process.env.AUTH_SECRET?.trim()) &&
    parseAdminAllowedEmailList().length > 0
  );
}
