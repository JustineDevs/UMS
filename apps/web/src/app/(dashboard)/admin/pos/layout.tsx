import { requirePagePermission } from "@/lib/require-page-permission";

export default async function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePagePermission("pos:use");
  return children;
}
