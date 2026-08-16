import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import {
  tryCreateSupabaseClient,
  upsertOAuthUser,
  isStaffRole,
  resolveStaffPermissionsForUserId,
} from "@universal-music-store/database";
import { loadGoogleCredentials, normalizeEmail } from "@universal-music-store/sdk";
import {
  isAdminE2eCredentialsConfigured,
  parseAdminAllowedEmailList,
} from "@/lib/admin-allowed-emails";

const PERMISSIONS_CACHE_TTL_MS = 60_000;
const staffSnapshotCache = new Map<
  string,
  { permissions: string[]; role: string | undefined; expiresAt: number }
>();

/**
 * Loads RBAC from Supabase (source of truth). Uses lowercase email for cache and lookup
 * so `ADMIN_ALLOWED_EMAILS` and Google casing match stored `users.email`.
 */
async function getCachedStaffSnapshot(email: string): Promise<{
  permissions: string[];
  role: string | undefined;
}> {
  const key = normalizeEmail(email);
  const cached = staffSnapshotCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return { permissions: cached.permissions, role: cached.role };
  }
  const supabase = tryCreateSupabaseClient();
  if (!supabase) return { permissions: [], role: undefined };

  const { data: row } = await supabase
    .from("users")
    .select("id")
    .eq("email", key)
    .maybeSingle();

  if (!row?.id) return { permissions: [], role: undefined };

  const userId = row.id as string;
  const [permissions, roleRes] = await Promise.all([
    resolveStaffPermissionsForUserId(supabase, userId),
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
  ]);
  const role = (roleRes.data?.role as string | undefined) ?? "customer";

  staffSnapshotCache.set(key, {
    permissions,
    role,
    expiresAt: Date.now() + PERMISSIONS_CACHE_TTL_MS,
  });
  return { permissions, role };
}

const google = loadGoogleCredentials("admin");

/**
 * Build options per call so the App Router `[...nextauth]` handler can register the E2E
 * Credentials provider using current `process.env` (matches `/sign-in/e2e`, which is evaluated
 * per request). `export const authOptions` is still a one-time snapshot for `getServerSession`
 * callers; JWT verification only needs a stable secret and callbacks.
 */
export function buildAuthOptions(): NextAuthOptions {
  return {
  debug: process.env.NEXTAUTH_DEBUG === "true",
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    GoogleProvider({
      clientId: google.clientId,
      clientSecret: google.clientSecret,
    }),
    ...(isAdminE2eCredentialsConfigured()
      ? [
          CredentialsProvider({
            id: "e2e-credentials",
            name: "E2E (credentials)",
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
              const reject = (reason: string) => {
                if (process.env.NEXTAUTH_DEBUG === "true") {
                  console.warn(`[admin auth] e2e credentials rejected: ${reason}`);
                }
                return null;
              };
              if (!credentials?.email || !credentials?.password) {
                return reject(
                  `missing credentials (email=${Boolean(credentials?.email)}, password=${Boolean(credentials?.password)}, keys=${Object.keys(credentials ?? {}).join(",")})`,
                );
              }
              const emailRaw =
                typeof credentials.email === "string" ? credentials.email : "";
              const pwd =
                typeof credentials.password === "string" ? credentials.password : "";
              const emailNorm = normalizeEmail(emailRaw);
              const allowed = parseAdminAllowedEmailList();
              if (!allowed.includes(emailNorm)) return reject("email not allow-listed");
              if (pwd !== process.env.NEXTAUTH_SECRET?.trim()) return reject("password mismatch");
              const supabase = tryCreateSupabaseClient();
              if (!supabase) return reject("Supabase unavailable");
              const { data } = await supabase
                .from("users")
                .select("id")
                .eq("email", emailNorm)
                .maybeSingle();
              if (!data?.id) return reject("user not found");
              const { data: roleRow } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", data.id)
                .maybeSingle();
              const role = roleRow?.role as string | undefined;
              if (!isStaffRole(role ?? "")) return reject(`role ${role ?? "missing"} is not staff`);
              return {
                id: data.id as string,
                email: emailNorm,
                name: "E2E Staff",
                role,
              };
            },
          }),
        ]
      : []),
  ],
  secret: process.env.NEXTAUTH_SECRET?.trim(),
  session: { strategy: "jwt", maxAge: 60 * 60 * 4 },
  cookies: {
    sessionToken: {
      name: "ums.admin-session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production" || process.env.NEXTAUTH_URL?.startsWith("https://") === true,
      },
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "e2e-credentials") {
        if (!isAdminE2eCredentialsConfigured()) return false;
        if (!user?.email) return false;
        const role = (user as { role?: string }).role;
        if (!isStaffRole(role ?? "")) return false;
        staffSnapshotCache.delete(normalizeEmail(user.email));
        return true;
      }
      if (!user?.email || account?.provider !== "google" || !account.providerAccountId) {
        return false;
      }
      const emailNorm = normalizeEmail(user.email);
      user.email = emailNorm;
      const promote =
        process.env.ADMIN_ALLOWED_EMAILS?.split(",")
          .map((s) => normalizeEmail(s))
          .filter(Boolean) ?? [];
      try {
        const supabase = tryCreateSupabaseClient();
        if (!supabase) {
          console.error("[admin auth] Supabase is not configured (missing SUPABASE_URL or keys)");
          return false;
        }
        const { role } = await upsertOAuthUser(
          supabase,
          {
            email: emailNorm,
            name: user.name,
            image: user.image,
            googleSub: account.providerAccountId,
          },
          { promoteEmails: promote },
        );
        user.role = role;
        if (!isStaffRole(role)) {
          return false;
        }
        staffSnapshotCache.delete(emailNorm);
        return true;
      } catch (err) {
        console.error("[admin auth] upsertOAuthUser failed:", err);
        return false;
      }
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        if (user.email) token.email = user.email;
        if (user.role) token.role = user.role;
        if (user.name !== undefined) token.name = user.name;
        if (user.image !== undefined) token.picture = user.image;
      }
      if (trigger === "update" && session && typeof session === "object") {
        const s = session as { name?: string | null };
        if (s.name !== undefined) token.name = s.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user?.email) {
        session.user.email = normalizeEmail(session.user.email);
      }
      if (session.user) {
        if (token.name !== undefined) session.user.name = token.name as string | null;
        if (token.picture !== undefined) session.user.image = token.picture as string | null;
        try {
          if (session.user.email) {
            const snapshot = await getCachedStaffSnapshot(session.user.email);
            session.user.permissions = snapshot.permissions;
            session.user.role = (token.role as string | undefined) ?? snapshot.role;
          } else {
            session.user.role = token.role as string | undefined;
          }
        } catch (err) {
          console.error("[admin auth] session RBAC refresh failed:", err);
          session.user.role = token.role as string | undefined;
        }
      }
      return session;
    },
  },
};
}

export const authOptions: NextAuthOptions = buildAuthOptions();
