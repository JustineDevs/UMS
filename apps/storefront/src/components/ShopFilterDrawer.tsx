"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  activeFilterCount: number;
  children: ReactNode;
};

export function ShopFilterDrawer({ activeFilterCount, children }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!open) {
      if (mountedRef.current) triggerRef.current?.focus();
      mountedRef.current = true;
      return;
    }

    const panel = panelRef.current;
    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
        ) ?? [],
      );
    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="w-full shrink-0 lg:w-64">
      <button
        ref={triggerRef}
        type="button"
        className="mb-6 inline-flex min-h-11 w-full items-center justify-between rounded border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm font-bold text-primary lg:hidden"
        aria-expanded={open}
        aria-controls="shop-filter-panel"
        data-hydrated={hydrated ? "true" : "false"}
        onClick={() => setOpen(true)}
      >
        <span>Filters</span>
        <span className="text-xs font-medium text-on-surface-variant">
          {activeFilterCount > 0 ? `${activeFilterCount} applied` : "Browse all"}
        </span>
      </button>

      <div
        id="shop-filter-panel"
        ref={panelRef}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? "Shop filters" : undefined}
        className={
          open
            ? "fixed inset-0 z-[60] overflow-y-auto bg-black/40 p-4 lg:static lg:z-auto lg:block lg:overflow-visible lg:bg-transparent lg:p-0"
            : "hidden lg:block"
        }
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        <div className="mx-auto max-h-[calc(100vh-2rem)] max-w-lg overflow-y-auto rounded-lg bg-surface-container-lowest p-4 shadow-xl lg:max-h-none lg:max-w-none lg:overflow-visible lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="mb-5 flex items-center justify-between lg:hidden">
            <h2 className="font-headline text-lg font-bold text-primary">Filters</h2>
            <button
              type="button"
              className="min-h-11 rounded border border-outline-variant px-4 py-2 text-sm font-semibold text-primary"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
