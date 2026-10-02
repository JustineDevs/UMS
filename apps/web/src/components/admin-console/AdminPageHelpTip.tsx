"use client";

import { useId } from "react";
import { usePathname } from "next/navigation";
import { getAdminPageHelp } from "@/config/admin-page-help";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AdminPageHelpTipProps = {
  purpose: string;
  usage: string;
};

/**
 * Accessible page help tooltip: hover and keyboard focus reveal a compact hint
 * without changing the page layout or opening a blocking panel.
 */
export function AdminPageHelpTip({ purpose, usage }: AdminPageHelpTipProps) {
  const tooltipId = useId();
  const summary = purpose.length > 90 ? `${purpose.slice(0, 87)}…` : purpose;

  return (
    <div className="group relative inline-flex shrink-0 pt-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 border-0 text-muted-foreground shadow-none"
        aria-describedby={tooltipId}
        title={`About this page: ${summary}`}
      >
        <CircleHelp className="size-5" aria-hidden="true" />
        <span className="sr-only">Page overview and tips</span>
      </Button>
      <div
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none invisible absolute right-0 top-full z-[100] mt-2 w-[min(22rem,calc(100vw - 2rem))] max-w-[calc(100vw - 2rem)] translate-x-0 rounded-md bg-foreground px-3 py-2 text-left text-xs leading-relaxed text-background opacity-0 shadow-lg transition-[opacity,visibility] duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
      >
        <p>{purpose}</p>
        <p className="mt-1 text-background/75">{usage}</p>
      </div>
    </div>
  );
}

/** Help icon for pages that do not use {@link AdminPageTitleWithHelp} (e.g. POS custom header). */
export function AdminPageHelpFromPath({ path }: { path?: string }) {
  const pathname = usePathname() ?? "";
  const help = getAdminPageHelp(path ?? pathname);
  if (!help) {
    return null;
  }
  return <AdminPageHelpTip purpose={help.purpose} usage={help.usage} />;
}
