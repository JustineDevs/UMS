import { AdminBreadcrumbs, AdminPageShell } from "@/components/admin-console";
import { requirePagePermission } from "@/lib/require-page-permission";
import { AuditLogExplorer } from "./AuditLogExplorer";

export const dynamic = "force-dynamic";

export default async function AuditCompliancePage() {
  await requirePagePermission("dashboard:read");

  return (
    <AdminPageShell
      title="Audit log"
      subtitle="Monitor staff actions and investigate changes from one source."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Audit log" }]}
        />
      }
    >
      <AuditLogExplorer />
    </AdminPageShell>
  );
}
