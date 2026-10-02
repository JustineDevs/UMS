import { LoyaltyPageClient } from "./loyalty-client";
import { fetchCustomersForAdmin } from "@/lib/customer-admin-bridge";

export default async function LoyaltyPage() {
  const customers = await fetchCustomersForAdmin(200);
  return <LoyaltyPageClient customers={customers} />;
}
