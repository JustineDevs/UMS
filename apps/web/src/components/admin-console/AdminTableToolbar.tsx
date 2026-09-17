import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminTableToolbar({
  leading,
  trailing,
  className,
}: {
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{leading}</div>
      {trailing ? <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 sm:justify-end">{trailing}</div> : null}
    </div>
  );
}
