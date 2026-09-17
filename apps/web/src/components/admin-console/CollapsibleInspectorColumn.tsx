"use client";

import { useCallback, useEffect, useId, useState } from "react";
import type { ReactNode } from "react";

export type CollapsibleInspectorColumnProps = {
  storageKey: string;
  children: ReactNode;
  /** Shown when the sidebar is collapsed (e.g. edge control). */
  expandLabel?: string;
  /** Shown when the sidebar is visible. */
  collapseLabel?: string;
};

function readStoredOpen(key: string): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(key);
    if (v === "0") return false;
    if (v === "1") return true;
    return null;
  } catch {
    return null;
  }
}

/**
 * Right-column inspector wrapper: hide/show with persisted preference (localStorage).
 * Keeps the same responsive shell contract as {@link AdminPageShell}’s inspector column.
 */
export function CollapsibleInspectorColumn({
  storageKey,
  children,
  expandLabel = "Show activity",
  collapseLabel = "Hide activity",
}: CollapsibleInspectorColumnProps) {
  const panelId = useId();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const stored = readStoredOpen(storageKey);
    if (stored !== null) setOpen(stored);
  }, [storageKey]);

  const persist = useCallback(
    (next: boolean) => {
      setOpen(next);
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        /* quota / private mode */
      }
    },
    [storageKey],
  );

  if (!open) {
    return (
      <div className="flex w-full shrink-0 flex-col border-t border-outline-variant/15 pt-4 xl:min-w-[3rem] xl:max-w-[3.75rem] xl:border-l xl:border-t-0 xl:pl-3 xl:pt-0">
        <button
          type="button"
          onClick={() => persist(true)}
          title={expandLabel}
          className="flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-outline-variant/20 bg-white px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-primary shadow-sm transition hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary xl:min-h-[8rem] xl:max-w-none xl:flex-1 xl:px-2 xl:py-4 xl:[writing-mode:vertical-rl] xl:rotate-180"
          aria-expanded="false"
        >
          {expandLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full shrink-0 border-t border-outline-variant/15 pt-6 xl:w-96 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => persist(false)}
          title={collapseLabel}
          className="min-h-[44px] touch-manipulation rounded-lg px-2 text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-expanded="true"
          aria-controls={panelId}
        >
          {collapseLabel}
        </button>
      </div>
      <div id={panelId}>{children}</div>
    </div>
  );
}
