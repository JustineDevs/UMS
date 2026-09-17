import { AdminBreadcrumbs, AdminPageShell, AuditTimeline } from "@/components/admin-console";
import { AdminPreferencesForm } from "@/components/AdminPreferencesForm";
import { requirePagePermission } from "@/lib/require-page-permission";

export const dynamic = "force-dynamic";

export default async function AdminPreferencesPage() {
  await requirePagePermission("settings:read");

  return (
    <AdminPageShell
      title="Workspace UI"
      subtitle="Layout density and default table sizes for this browser. Account name and email are under the profile menu (Preferences) in the sidebar."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[
            { label: "Dashboard", href: "/admin" },
            { label: "Settings", href: "/admin/settings/preferences" },
            { label: "Workspace UI" },
          ]}
        />
      }
      inspector={<AuditTimeline title="Recent activity" />}
    >
      <AdminPreferencesForm />
    </AdminPageShell>
  );
}
