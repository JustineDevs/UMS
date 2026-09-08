import type { NextAuthOptions } from "next-auth";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";
import {
  loadGoogleCredentials,
  buildSharedJwtCallbackWithResolver,
  buildSharedSessionCallback,
} from "@universal-music-store/sdk";
import { getAuthSecret } from "@/lib/auth-secret";
import { findOrCreateMedusaCustomerIdByEmail } from "@/lib/medusa-customer-resolve";

const google = loadGoogleCredentials("storefront");

const sharedJwt = buildSharedJwtCallbackWithResolver({
  resolveCustomerId: findOrCreateMedusaCustomerIdByEmail,
});
const sharedSession = buildSharedSessionCallback();

export const authOptions: NextAuthOptions = {
  debug: process.env.NEXTAUTH_DEBUG === "true",
  providers: [
    GoogleProvider({
      clientId: google.clientId,
      clientSecret: google.clientSecret,
    }),
  ],
  secret: getAuthSecret(),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/sign-in" },
  cookies: {
    sessionToken: {
      name: "ums.storefront-session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false,
      },
    },
  },
  callbacks: {
    jwt: sharedJwt as NextAuthOptions["callbacks"] extends { jwt?: infer J } ? J : never,
    session: sharedSession as NextAuthOptions["callbacks"] extends { session?: infer S } ? S : never,
  },
};

/**
 * Local browser QA may expose the bypass flag to the client so its session
 * provider can render the same identity. Never let a public flag disable auth
 * in a production server process.
 */
export function isStorefrontAuthDisabled(): boolean {
  const serverFlags = [process.env.AUTH_DISABLED, process.env.AUTH_DISABLE];
  if (serverFlags.some((value) => value === "true")) return true;
  if (process.env.NODE_ENV === "production") return false;
  return [
    process.env.NEXT_PUBLIC_AUTH_DISABLED,
    process.env.NEXT_PUBLIC_AUTH_DISABLE,
  ].some((value) => value === "true");
}

/** Explicit auth-disabled mode is reserved for controlled browser QA. */
export async function getStorefrontSession(): Promise<Session | null> {
  if (isStorefrontAuthDisabled()) {
    return {
      user: { name: "Local QA", email: "e2e-test@example.com" },
      authenticatedAt: Math.floor(Date.now() / 1000),
      expires: "2099-12-31T23:59:59.999Z",
    } as Session;
  }
  return getServerSession(authOptions);
}
