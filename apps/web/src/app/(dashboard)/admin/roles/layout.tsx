import { requirePagePermission } from "@/lib/require-page-permission";

export default async function RolesLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission("employees:read");
  return children;
}
