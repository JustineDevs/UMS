import { AdminCmsSectionNav } from "@/components/admin-console/AdminCmsSectionNav";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function CmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePagePermission("content:read");
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AdminCmsSectionNav />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
