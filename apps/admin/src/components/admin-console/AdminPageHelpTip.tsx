"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getAdminPageHelp } from "@/config/admin-page-help";

export type AdminPageHelpTipProps = {
  purpose: string;
  usage: string;
};

/**
 * Accessible help control: click or keyboard toggles a short panel (mobile-friendly).
 * Hover alone is unreliable on touch devices; we still show a concise native title on the button.
 */
export function AdminPageHelpTip({ purpose, usage }: AdminPageHelpTipProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        close();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const summary = purpose.length > 90 ? `${purpose.slice(0, 87)}…` : purpose;

  return (
    <div ref={wrapRef} className="relative inline-flex shrink-0 pt-1">
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-expanded={open}
        aria-controls={panelId}
        aria-describedby={open ? panelId : undefined}
        title={`About this page: ${summary}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden>
          help
        </span>
        <span className="sr-only">Page overview and tips</span>
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label="Page guide"
            className="absolute left-0 top-full z-[100] mt-2 w-[min(100vw-2rem,22rem)] rounded-lg border border-border bg-popover p-4 text-left text-popover-foreground shadow-lg"
        >
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Overview
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            {purpose}
          </p>
          <p className="mt-4 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Tips
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {usage}
          </p>
        </div>
      ) : null}
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
