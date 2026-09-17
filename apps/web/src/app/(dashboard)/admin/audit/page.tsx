import { AdminBreadcrumbs, AdminPageShell, AuditTimeline } from "@/components/admin-console";
import { requirePagePermission } from "@/lib/require-page-permission";
import { AuditLogExplorer } from "./AuditLogExplorer";

export const dynamic = "force-dynamic";

export default async function AuditCompliancePage() {
  await requirePagePermission("dashboard:read");

  return (
    <AdminPageShell
      title="Audit log"
      subtitle="A log of staff actions. Export needs permission from your administrator."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Audit log" }]}
        />
      }
      inspector={<AuditTimeline title="Recent activity" />}
    >
      <AuditLogExplorer />
    </AdminPageShell>
  );
}
