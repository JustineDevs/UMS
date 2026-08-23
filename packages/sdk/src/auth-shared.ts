/**
 * Shared auth utilities used by both storefront and admin NextAuth configurations.
 * Provides common Google provider setup, JWT/session callback builders,
 * and session validation helpers for SSO alignment.
 */

/**
 * Reads and validates Google OAuth credentials from environment.
 * Logs a dev warning when credentials are missing.
 */
export function loadGoogleCredentials(appLabel: string): {
  clientId: string;
  clientSecret: string;
  configured: boolean;
} {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  const configured = Boolean(clientId && clientSecret);

  if (process.env.NODE_ENV === "development" && !configured) {
    console.warn(
      `[${appLabel} auth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is empty. Google sign-in will not work. Check root .env.local.`,
    );
  }

  return { clientId, clientSecret, configured };
}

export type SharedSessionUser = {
  id?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  role?: string;
  permissions?: string[];
};

export type SharedSession = {
  user?: SharedSessionUser;
  authenticatedAt?: number;
};

/**
 * Standard JWT callback that maps user fields into the token.
 * Both apps share the same core fields: email, name, image.
 */
export function buildSharedJwtCallback() {
  return async function jwtCallback({
    token,
    user,
    account,
  }: {
    token: Record<string, unknown>;
    user?: {
      id?: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      role?: string;
    } | null;
    account?: { providerAccountId?: string } | null;
  }): Promise<Record<string, unknown>> {
    if (user) {
      token.authenticatedAt = Math.floor(Date.now() / 1000);
      if (user.id) token.id = user.id;
      if (user.email) token.email = user.email;
      if (user.name !== undefined) token.name = user.name;
      if (user.image !== undefined) token.picture = user.image;
      if (user.role) token.role = user.role;
    }
    if (!token.id && account?.providerAccountId) {
      token.id = account.providerAccountId;
    }
    return token;
  };
}

/**
 * Standard session callback that hydrates session.user from the JWT token.
 * Admin extends this with RBAC lookup; storefront uses as-is.
 */
export function buildSharedSessionCallback() {
  return async function sessionCallback({
    session,
    token,
  }: {
    session: SharedSession;
    token: Record<string, unknown>;
  }) {
    if (typeof token.authenticatedAt === "number") {
      session.authenticatedAt = token.authenticatedAt;
    }
    if (session.user) {
      session.user.id =
        (token.id as string | undefined) ?? (token.sub as string | undefined) ?? session.user.id;
      session.user.email = (token.email as string | undefined) ?? undefined;
      session.user.name = (token.name as string | undefined) ?? undefined;
      session.user.image = (token.picture as string | undefined) ?? undefined;
      if (token.role) {
        session.user.role = token.role as string;
      }
    }
    return session;
  };
}

/**
 * Validates that a session has a signed-in user with an email.
 * Returns the normalized email or null for unauthenticated requests.
 */
export function extractSessionEmail(
  session: { user?: { email?: string | null } } | null,
): string | null {
  const raw = session?.user?.email?.trim().toLowerCase();
  if (!raw || !raw.includes("@")) return null;
  return raw;
}

/**
 * Checks whether a session user has a role that grants staff-level access.
 * This is a lightweight check shared between admin and storefront.
 */
export function isSessionStaff(
  session: { user?: { role?: string } } | null,
): boolean {
  const role = session?.user?.role;
  return role === "admin" || role === "staff";
}

/**
 * Normalizes email for consistent lookup/cache across both apps.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
