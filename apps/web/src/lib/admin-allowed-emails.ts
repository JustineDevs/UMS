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
 * Registers the E2E Credentials provider and enables `/sign-in/e2e` (local dev only).
 * Main `/sign-in` is Google-only; Playwright uses `/sign-in/e2e`.
 */
export function isAdminE2eCredentialsConfigured(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    Boolean(process.env.AUTH_SECRET?.trim()) &&
    parseAdminAllowedEmailList().length > 0
  );
}
