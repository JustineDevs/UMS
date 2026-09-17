import { AdminBreadcrumbs, AdminPageShell, AuditTimeline } from "@/components/admin-console";
import { requirePagePermission } from "@/lib/require-page-permission";
import { WorkflowQueueExplorer } from "./WorkflowQueueExplorer";

export const dynamic = "force-dynamic";

export default async function WorkflowCompliancePage() {
  await requirePagePermission("dashboard:read");

  return (
    <AdminPageShell
      title="Workflow"
      subtitle="Workflow states for content, campaigns, and related records. Orders stay in your checkout system."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Workflow" }]}
        />
      }
      inspector={<AuditTimeline title="Recent activity" />}
    >
      <WorkflowQueueExplorer />
    </AdminPageShell>
  );
}
