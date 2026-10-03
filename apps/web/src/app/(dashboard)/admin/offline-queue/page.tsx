import { AdminBreadcrumbs, AdminPageShell } from "@/components/admin-console";
import { requirePagePermission } from "@/lib/require-page-permission";
import { OfflineQueuePanel } from "./OfflineQueuePanel";

export const dynamic = "force-dynamic";

export default async function OfflineQueuePage() {
  await requirePagePermission("pos:use");

  return (
    <AdminPageShell
      title="Offline queue"
      subtitle="Review sales cached on POS devices while they wait for synchronization."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Offline queue" }]}
        />
      }
    >
      <OfflineQueuePanel />
    </AdminPageShell>
  );
}
