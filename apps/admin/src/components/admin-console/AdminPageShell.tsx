import type { ReactNode } from "react";
import { Separator } from "@universal-music-store/ui";
import { CollapsibleInspectorColumn } from "./CollapsibleInspectorColumn";
import { AdminPageTitleWithHelp } from "./AdminPageTitleWithHelp";

export type AdminPageShellProps = {
  /** Omit when the page provides its own hero (e.g. POS). */
  title?: string;
  subtitle?: string;
  /** Skip default title block; still renders filters and canvas. */
  hideHeader?: boolean;
  /** Thin top row (global actions, context) */
  commandBar?: ReactNode;
  /** Breadcrumbs or secondary wayfinding */
  breadcrumbs?: ReactNode;
  /** Permission denied, commerce banners, etc. */
  bannerSlot?: ReactNode;
  /** Search, filters, tabs */
  filters?: ReactNode;
  /** Primary header actions (buttons) */
  actions?: ReactNode;
  /** Main workspace */
  children: ReactNode;
  /** Right-side inspector (desktop column; mobile stacks below) */
  inspector?: ReactNode;
  /**
   * When set with `inspector`, wraps the inspector in a hide/show column with persisted preference.
   */
  inspectorCollapsible?: {
    storageKey: string;
    expandLabel?: string;
    collapseLabel?: string;
  };
  /** Sticky bottom strip: toast region, last audit line */
  footNote?: ReactNode;
  className?: string;
};

/**
 * Shared layout contract for every admin route: command bar, header, filters, canvas, optional inspector, foot strip.
 */
export function AdminPageShell({
  title,
  subtitle,
  hideHeader,
  commandBar,
  breadcrumbs,
  bannerSlot,
  filters,
  actions,
  children,
  inspector,
  inspectorCollapsible,
  footNote,
  className = "",
}: AdminPageShellProps) {
  return (
    <div
      className={`admin-page-reveal flex min-h-0 min-w-0 flex-1 flex-col bg-background ${className}`}
    >
      {commandBar ? (
        <div className="border-b border-border/60 bg-background/80 px-4 py-2 backdrop-blur-sm lg:px-8">
          {commandBar}
        </div>
      ) : null}

      <div className="flex flex-1 flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        {breadcrumbs ? (
          <div className="mb-4 space-y-3 text-sm text-muted-foreground">
            {breadcrumbs}
            <Separator className="bg-border/60" />
          </div>
        ) : null}
        {bannerSlot ? <div className="mb-6 space-y-4">{bannerSlot}</div> : null}

        {!hideHeader && (title || subtitle || actions) ? (
          <div className="mb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                {title ? <AdminPageTitleWithHelp title={title} /> : null}
                {subtitle ? <p className="max-w-2xl text-sm leading-5 text-muted-foreground">{subtitle}</p> : null}
              </div>
              {actions ? <div className="flex min-w-0 max-w-full shrink flex-wrap items-center justify-end gap-2">{actions}</div> : null}
            </div>
          </div>
        ) : null}

        {filters ? <div className="mb-6">{filters}</div> : null}

        <div className="flex min-h-0 flex-1 flex-col gap-6 xl:flex-row">
          <div className="min-w-0 flex-1">{children}</div>
          {inspector ? (
            inspectorCollapsible ? (
              <CollapsibleInspectorColumn
                storageKey={inspectorCollapsible.storageKey}
                expandLabel={inspectorCollapsible.expandLabel}
                collapseLabel={inspectorCollapsible.collapseLabel}
              >
                {inspector}
              </CollapsibleInspectorColumn>
            ) : (
              <div className="w-full shrink-0 border-t border-border/60 pt-6 xl:w-96 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
                {inspector}
              </div>
            )
          ) : null}
        </div>
      </div>

      {footNote ? (
        <div className="sticky bottom-0 z-10 border-t border-border/60 bg-background/95 px-4 py-3 text-sm shadow-[0_-4px_12px_rgba(0,0,0,0.04)] backdrop-blur-sm lg:px-10">
          {footNote}
        </div>
      ) : null}
    </div>
  );
}
