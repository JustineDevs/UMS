import type { ReactNode } from "react";
import { AdminPageShell, type AdminPageShellProps } from "./AdminPageShell";

export type CrudManagerLayoutProps = Omit<AdminPageShellProps, "children"> & {
  /** Table, cards, or list */
  children: ReactNode;
  /** Shown when list is empty */
  emptyState?: ReactNode;
  /** Toolbar above the table (bulk actions) */
  bulkActions?: ReactNode;
};

/**
 * List + filters + optional bulk actions + empty state, on top of {@link AdminPageShell}.
 */
export function CrudManagerLayout({
  children,
  emptyState,
  bulkActions,
  ...shell
}: CrudManagerLayoutProps) {
  return (
    <AdminPageShell {...shell}>
      {bulkActions ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">{bulkActions}</div>
      ) : null}
      {children}
      {emptyState ? <div className="mt-6">{emptyState}</div> : null}
    </AdminPageShell>
  );
}
