import { AdminBreadcrumbs, AdminPageShell } from "@/components/admin-console";
import { AdminPreferencesForm } from "@/components/AdminPreferencesForm";
import { requirePagePermission } from "@/lib/require-page-permission";

export const dynamic = "force-dynamic";

export default async function AdminPreferencesPage() {
  await requirePagePermission("settings:read");

  return (
    <AdminPageShell
      title="Workspace UI"
      subtitle="Tune display density, inventory defaults, and accessibility behavior for this browser. These settings apply only to your local admin workspace."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[
            { label: "Dashboard", href: "/admin" },
            { label: "Settings", href: "/admin/settings/preferences" },
            { label: "Workspace UI" },
          ]}
        />
      }
    >
      <AdminPreferencesForm />
    </AdminPageShell>
  );
}
