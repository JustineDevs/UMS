import type { NextAuthOptions } from "next-auth";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";
import {
  loadGoogleCredentials,
  buildSharedJwtCallback,
  buildSharedSessionCallback,
} from "@universal-music-store/sdk";

const google = loadGoogleCredentials("storefront");

const sharedJwt = buildSharedJwtCallback();
const sharedSession = buildSharedSessionCallback();

export const authOptions: NextAuthOptions = {
  debug: process.env.NEXTAUTH_DEBUG === "true",
  providers: [
    GoogleProvider({
      clientId: google.clientId,
      clientSecret: google.clientSecret,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET?.trim(),
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

/** Explicit auth-disabled mode is reserved for controlled browser QA. */
export async function getStorefrontSession(): Promise<Session | null> {
  if (process.env.AUTH_DISABLED === "true" || process.env.AUTH_DISABLE === "true") {
    return {
      user: { name: "Local QA", email: "e2e-test@example.com" },
      authenticatedAt: Math.floor(Date.now() / 1000),
      expires: "2099-12-31T23:59:59.999Z",
    } as Session;
  }
  return getServerSession(authOptions);
}
