import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AdminPageTitleWithHelp } from "./AdminPageTitleWithHelp";

export function AdminPageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        <AdminPageTitleWithHelp title={title} />
        {subtitle ? <p suppressHydrationWarning className="max-w-2xl text-sm leading-5 text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex min-w-0 max-w-full shrink flex-wrap items-center justify-end gap-2">{actions}</div> : null}
    </header>
  );
}
