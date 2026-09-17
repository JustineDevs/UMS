import { requirePagePermission } from "@/lib/require-page-permission";

export default async function CampaignsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePagePermission("campaigns:read");
  return children;
}
