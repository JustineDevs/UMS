"use client";

import { useCallback, useEffect, useState } from "react";
import { Menu, Search } from "lucide-react";
import { AdminCommandPalette } from "@/components/AdminCommandPalette";
import { AdminPreferenceSync } from "@/components/AdminPreferenceSync";
import { AdminToastProvider } from "@/components/admin-console";
import { AdminSidebar } from "@/components/AdminSidebar";

function cn(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
    const media = window.matchMedia("(max-width: 1023px)");
    const resetForMobile = () => {
      if (media.matches) setSidebarCollapsed(false);
    };
    resetForMobile();
    media.addEventListener("change", resetForMobile);
    return () => media.removeEventListener("change", resetForMobile);
  }, []);

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
            <Menu aria-hidden="true" className="size-5" />
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
          <Search aria-hidden="true" className="size-5" />
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
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
      />

      <div data-admin-content className={cn("flex min-h-[100dvh] min-w-0 flex-1 flex-col overflow-x-hidden pt-14 transition-[margin] duration-200 lg:pt-0", sidebarCollapsed ? "lg:ml-[4.5rem]" : "lg:ml-80")}>
        <AdminToastProvider>{children}</AdminToastProvider>
      </div>
    </div>
  );
}
