/** Shared, framework-neutral authentication helpers for the storefront and admin. */

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
      `[${appLabel} auth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is empty. Check the local environment.`,
    );
  }
  return { clientId, clientSecret, configured };
}

export type SharedSessionUser = {
  id?: string;
  medusaCustomerId?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  role?: string;
  permissions?: string[];
};

type SharedSession = {
  user?: SharedSessionUser;
  authenticatedAt?: number;
};

export function buildSharedJwtCallback() {
  return buildSharedJwtCallbackWithResolver();
}

export function buildSharedJwtCallbackWithResolver(options?: {
  resolveCustomerId?: (_email: string) => Promise<string | null>;
}) {
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
      if (!token.medusaCustomerId && user.email && options?.resolveCustomerId) {
        try {
          const medusaCustomerId = await options.resolveCustomerId(user.email);
          if (medusaCustomerId) token.medusaCustomerId = medusaCustomerId;
        } catch {
          // Authentication remains available if the commerce identity lookup is unavailable.
        }
      }
    }
    if (!token.id && account?.providerAccountId) token.id = account.providerAccountId;
    return token;
  };
}

export function buildSharedSessionCallback() {
  return async function sessionCallback({
    session,
    token,
  }: {
    session: SharedSession;
    token: Record<string, unknown>;
  }) {
    if (typeof token.authenticatedAt === "number") session.authenticatedAt = token.authenticatedAt;
    if (session.user) {
      session.user.id = (token.id as string | undefined) ?? (token.sub as string | undefined) ?? session.user.id;
      if (typeof token.medusaCustomerId === "string") session.user.medusaCustomerId = token.medusaCustomerId;
      session.user.email = (token.email as string | undefined) ?? undefined;
      session.user.name = (token.name as string | undefined) ?? undefined;
      session.user.image = (token.picture as string | undefined) ?? undefined;
      if (token.role) session.user.role = token.role as string;
    }
    return session;
  };
}

export function extractSessionEmail(
  session: { user?: { email?: string | null } } | null,
): string | null {
  const email = session?.user?.email?.trim().toLowerCase();
  return email && email.includes("@") ? email : null;
}

export function isSessionStaff(session: { user?: { role?: string } } | null): boolean {
  const role = session?.user?.role;
  return role === "admin" || role === "staff";
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
