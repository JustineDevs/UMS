import type { Session } from "next-auth";
import { findOrCreateMedusaCustomerIdByEmail } from "@/lib/medusa-customer-resolve";

export async function resolveWishlistCustomerId(
  session: Session | null,
): Promise<string | null> {
  const user = session?.user as (Session["user"] & {
    medusaCustomerId?: unknown;
  }) | undefined;
  const directId =
    typeof user?.medusaCustomerId === "string" ? user.medusaCustomerId.trim() : "";
  if (directId) return directId;

  const email = user?.email?.trim();
  return email ? findOrCreateMedusaCustomerIdByEmail(email) : null;
}
