"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminCommandPalette } from "@/components/AdminCommandPalette";
import { AdminPreferenceSync } from "@/components/AdminPreferenceSync";
import { AdminToastProvider } from "@/components/admin-console";
import { AdminSidebar } from "@/components/AdminSidebar";

export function AdminDashboardChrome({
  children,
  commandPaletteEnabled = true,
  localAuthBypass = false,
}: {
  children: React.ReactNode;
  commandPaletteEnabled?: boolean;
  localAuthBypass?: boolean;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  const closeNav = useCallback(() => setMobileNavOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (commandPaletteEnabled && e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [commandPaletteEnabled]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNav();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen, closeNav]);

  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  return (
    <div data-admin-shell className="admin-shell flex min-h-screen">
      <AdminPreferenceSync />
      {commandPaletteEnabled ? (
        <div data-command-menu="admin" data-command-menu-hotkey="mod-k">
          <AdminCommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
        </div>
      ) : null}

      <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 lg:hidden">
        <div className="flex min-w-0 flex-1 items-center">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-200"
            aria-expanded={mobileNavOpen}
            aria-controls="admin-sidebar-nav"
            aria-label="Open navigation menu"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
          <span className="ml-3 truncate text-sm font-semibold text-primary">Back office</span>
        </div>
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          disabled={!commandPaletteEnabled}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-200"
          aria-label="Open search"
        >
          <span className="material-symbols-outlined text-2xl">search</span>
        </button>
      </header>

      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Close navigation menu"
          onClick={closeNav}
        />
      ) : null}

      <AdminSidebar
        mobileOpen={mobileNavOpen}
        onNavigate={closeNav}
        onOpenSearch={() => setCommandOpen(true)}
        localAuthBypass={localAuthBypass}
      />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden pt-14 lg:ml-72 lg:pt-0">
        <AdminToastProvider>{children}</AdminToastProvider>
      </div>
    </div>
  );
}
