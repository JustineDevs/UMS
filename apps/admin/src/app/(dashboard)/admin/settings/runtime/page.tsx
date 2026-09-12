import { AdminBreadcrumbs, AdminPageShell, AuditTimeline } from "@/components/admin-console";
import { PlatformRuntimeSettingsEditor } from "@/components/PlatformRuntimeSettingsEditor";

export const dynamic = "force-dynamic";

export default function RuntimeSettingsPage() {
  return <AdminPageShell title="Runtime settings" subtitle="Manage tenant-scoped storefront and operational defaults without editing deployment secrets." breadcrumbs={<AdminBreadcrumbs items={[{ label: "Dashboard", href: "/admin" }, { label: "Settings", href: "/admin/settings/preferences" }, { label: "Runtime settings" }]} />} inspector={<AuditTimeline title="Recent activity" />}><PlatformRuntimeSettingsEditor /></AdminPageShell>;
}
