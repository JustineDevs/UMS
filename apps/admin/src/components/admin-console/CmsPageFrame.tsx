import type { ReactNode } from "react";
import { AdminBreadcrumbs } from "./AdminBreadcrumbs";
import { AdminPageShell } from "./AdminPageShell";
import { AuditTimeline } from "./AuditTimeline";
import { CmsSurfaceRail } from "./CmsSurfaceRail";

export function CmsPageFrame({
  title,
  subtitle,
  children,
  inspector = <AuditTimeline title="Recent activity" />,
  showSurfaceRail = true,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  inspector?: ReactNode;
  showSurfaceRail?: boolean;
}) {
  return (
    <AdminPageShell
      title={title}
      subtitle={subtitle}
      breadcrumbs={
        <AdminBreadcrumbs
          items={[
            { label: "Dashboard", href: "/admin" },
            { label: "Content", href: "/admin/cms" },
            { label: title },
          ]}
        />
      }
      inspector={inspector}
    >
      {showSurfaceRail ? (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <CmsSurfaceRail />
          <div className="min-w-0">{children}</div>
        </div>
      ) : (
        children
      )}
    </AdminPageShell>
  );
}
