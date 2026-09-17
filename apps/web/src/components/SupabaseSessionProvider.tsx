"use client";

import { SupabaseSessionProvider as Provider } from "@/lib/auth-client";

export function SupabaseSessionProvider({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>;
}
