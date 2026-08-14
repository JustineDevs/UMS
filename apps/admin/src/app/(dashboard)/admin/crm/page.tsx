import {
  AdminBreadcrumbs,
  AdminPageShell,
  AuditTimeline,
} from "@/components/admin-console";
import { fetchMedusaCustomersForAdmin } from "@/lib/customers-bridge";
import { requirePagePermission } from "@/lib/require-page-permission";
import { CrmClientEnhancements } from "./CrmClientEnhancements";
import { ReferenceCrmDashboard } from "./ReferenceCrmDashboard";
import { NANGO_CRM_SUPPORTED_APPS } from "@universal-music-store/platform-data";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  await requirePagePermission("crm:read");
  const customers = await fetchMedusaCustomersForAdmin(120);
  const registeredCount = customers.filter((customer) => customer.has_account).length;

  return (
    <AdminPageShell
      title="CRM"
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "CRM" }]}
        />
      }
      inspector={<AuditTimeline title="Recent activity" />}
    >
      <ReferenceCrmDashboard />

      <div className="mt-6">
        <CrmClientEnhancements
          customers={customers}
          registeredCount={registeredCount}
          supportedApps={NANGO_CRM_SUPPORTED_APPS}
        />
      </div>
    </AdminPageShell>
  );
}
