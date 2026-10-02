import {
  AdminBreadcrumbs,
  AdminPageShell,
} from "@/components/admin-console";
import { requirePagePermission } from "@/lib/require-page-permission";
import { ReferenceCrmDashboard } from "./ReferenceCrmDashboard";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  await requirePagePermission("crm:read");

  return (
    <AdminPageShell
      title="CRM"
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "CRM" }]}
        />
      }
    >
      <ReferenceCrmDashboard />
    </AdminPageShell>
  );
}
