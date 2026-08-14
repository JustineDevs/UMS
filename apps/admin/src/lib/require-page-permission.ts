import { staffHasPermission, staffPermissionListForSession } from "@universal-music-store/database";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";

export async function requirePagePermission(permissionKey: string): Promise<void> {
  if (process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production") return;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/sign-in");
  }
  const perms = staffPermissionListForSession(session);
  if (!staffHasPermission(perms, permissionKey)) {
    // `/admin` must not call `requirePagePermission("dashboard:read")` or this becomes an infinite redirect.
    redirect("/admin?denied=" + encodeURIComponent(permissionKey));
  }
}

/** User needs at least one of the listed permissions (e.g. content or catalog read). */
export async function requireAnyPagePermission(permissionKeys: readonly string[]): Promise<void> {
  if (process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production") return;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/sign-in");
  }
  const perms = staffPermissionListForSession(session);
  if (!permissionKeys.some((k) => staffHasPermission(perms, k))) {
    redirect("/admin?denied=" + encodeURIComponent(permissionKeys.join(",")));
  }
}
