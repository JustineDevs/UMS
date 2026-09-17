import { requirePagePermission } from "@/lib/require-page-permission";

export default async function DevicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePagePermission("devices:manage");
  return children;
}
