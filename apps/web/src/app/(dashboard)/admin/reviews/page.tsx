import { AdminBreadcrumbs, AdminPageShell } from "@/components/admin-console";
import { ReviewsModerationClient } from "@/components/ReviewsModerationClient";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function AdminReviewsPage() {
  await requirePagePermission("content:read");

  return (
    <AdminPageShell
      title="Product reviews"
      subtitle="Approve, reject, or hide customer reviews before they appear on the storefront."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[
            { label: "Dashboard", href: "/admin" },
            { label: "Reviews" },
          ]}
        />
      }
    >
      <p className="mb-6 text-sm text-on-surface-variant">
        Pending reviews need approval. Only approved reviews are visible publicly. Actions require the{" "}
        <code className="rounded bg-slate-100 px-1 text-xs">content:write</code> permission.
      </p>
      <ReviewsModerationClient />
    </AdminPageShell>
  );
}
