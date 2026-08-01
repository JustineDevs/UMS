"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import posthog from "posthog-js";

function PostHogSessionIdentity() {
  const { data: session, status } = useSession();
  const identifiedCustomerId = useRef<string | null>(null);
  const customerId =
    (session?.user as Record<string, unknown> | undefined)?.medusaCustomerId;

  useEffect(() => {
    if (
      status !== "authenticated" ||
      typeof customerId !== "string" ||
      !customerId.trim()
    ) {
      return;
    }

    const distinctId = customerId.trim();
    if (identifiedCustomerId.current === distinctId) return;
    if (identifiedCustomerId.current) posthog.reset();

    posthog.identify(distinctId, {
      email: session.user?.email ?? undefined,
      name: session.user?.name ?? undefined,
    });
    identifiedCustomerId.current = distinctId;
  }, [customerId, session?.user?.email, session?.user?.name, status]);

  return null;
}

export function NextAuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <PostHogSessionIdentity />
      {children}
    </SessionProvider>
  );
}
