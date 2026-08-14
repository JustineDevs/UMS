export type IdentityRole = "customer" | "staff" | "admin" | "super_admin";

export type UnifiedIdentity = {
  userId: string;
  email: string;
  roles: IdentityRole[];
  orgId?: string;
  staffId?: string;
  customerId?: string;
  ssoProvider?: "google" | "microsoft" | "saml" | "local";
  sessionSource: "storefront" | "admin" | "api" | "pos";
};

export function hasRole(identity: UnifiedIdentity, role: IdentityRole): boolean {
  return identity.roles.includes(role);
}

export function isStaff(identity: UnifiedIdentity): boolean {
  return identity.roles.some((r) => r === "staff" || r === "admin" || r === "super_admin");
}

export function isCustomer(identity: UnifiedIdentity): boolean {
  return identity.roles.includes("customer");
}

export function canAccessAdmin(identity: UnifiedIdentity): boolean {
  return isStaff(identity);
}

export function canAccessStorefront(identity: UnifiedIdentity): boolean {
  return true;
}

export function resolveIdentityFromSession(session: {
  user?: { email?: string; id?: string; role?: string };
  source?: string;
}): UnifiedIdentity | null {
  if (!session.user?.email || !session.user?.id) return null;

  const roleStr = session.user.role ?? "customer";
  const roles: IdentityRole[] = [];
  if (roleStr === "super_admin") roles.push("super_admin", "admin", "staff");
  else if (roleStr === "admin") roles.push("admin", "staff");
  else if (roleStr === "staff") roles.push("staff");
  else roles.push("customer");

  return {
    userId: session.user.id,
    email: session.user.email,
    roles,
    sessionSource: (session.source as UnifiedIdentity["sessionSource"]) ?? "storefront",
  };
}
