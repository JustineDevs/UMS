import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminEntityCell({
  primary,
  secondary,
  leading,
  className,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  leading?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 space-y-0.5">
        <div className="truncate font-medium leading-5">{primary}</div>
        {secondary ? <div className="truncate text-xs leading-4 text-muted-foreground">{secondary}</div> : null}
      </div>
    </div>
  );
}
