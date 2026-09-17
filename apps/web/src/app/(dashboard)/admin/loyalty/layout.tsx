import { requirePagePermission } from "@/lib/require-page-permission";

export default async function LoyaltyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePagePermission("loyalty:read");
  return children;
}
