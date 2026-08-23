"use client";

import { SessionProvider } from "next-auth/react";

const localAuthBypass =
  process.env.NEXT_PUBLIC_AUTH_DISABLED === "true" ||
  process.env.NEXT_PUBLIC_AUTH_DISABLE === "true";

export function NextAuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider
      session={
        localAuthBypass
          ? {
              user: {
                id: "e2e-test-user",
                email: "e2e-test@example.com",
                name: "E2E Tester",
              },
              expires: "2099-01-01T00:00:00.000Z",
            }
          : undefined
      }
    >
      {children}
    </SessionProvider>
  );
}
