"use client";

import type { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { staffHasPermission } from "@universal-music-store/platform-data";

export function PermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { data } = useSession();
  const ok = staffHasPermission(data?.user?.permissions ?? [], permission);
  if (!ok) return <>{fallback}</>;
  return <>{children}</>;
}
