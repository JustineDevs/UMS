"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  staffHasPermission,
  staffPermissionListForSession,
} from "@universal-music-store/platform-data";
import { Button } from "@universal-music-store/ui";
import { ADMIN_NAV_GROUPS, type AdminNavItem } from "@/config/admin-nav";
import { AdminProfilePreferencesDialog } from "@/components/AdminProfilePreferencesDialog";

function cn(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function itemHasPermission(item: AdminNavItem, permissions: string[]): boolean {
  return (
    staffHasPermission(permissions, item.permission) ||
    (item.children ?? []).some((child) => itemHasPermission(child, permissions))
  );
}

function itemIsActive(item: AdminNavItem, pathname: string): boolean {
  const route = item.href.split("?", 1)[0];
  return (
    pathname === route ||
    (route !== "/admin" && pathname.startsWith(route)) ||
    (item.children ?? []).some((child) => itemIsActive(child, pathname))
  );
}

export type AdminSidebarProps = {
  /** When false, sidebar is off-canvas on small screens (use with mobile overlay). Desktop (lg+) always visible. */
  mobileOpen?: boolean;
  /** Called after navigating (e.g. close mobile drawer). */
  onNavigate?: () => void;
  /** Opens the Cmd+K command palette (desktop quick access). */
  onOpenSearch?: () => void;
  /** Explicit development-only auth bypass state from the server layout. */
  localAuthBypass?: boolean;
};

export function AdminSidebar({
  mobileOpen = true,
  onNavigate,
  onOpenSearch,
  localAuthBypass = false,
}: AdminSidebarProps) {
  const pathname = usePathname() ?? "/admin";
  const { data: session } = useSession();
  const sessionPerms = staffPermissionListForSession(session);
  // The local auth bypass is server-only, so the client session remains empty
  // while developing. Mirror that explicit non-production setting for nav
  // visibility without weakening authenticated production RBAC.
  const perms =
    sessionPerms.length > 0
      ? sessionPerms
      : localAuthBypass
        ? ["*"]
        : sessionPerms;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <aside
      id="admin-sidebar-nav"
      className={cn(
        "fixed left-0 top-0 z-50 flex h-dvh w-72 flex-col gap-2 overflow-hidden bg-slate-50 p-4 transition-transform duration-200 ease-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
    >
      <div className="px-2 py-5">
        <Link
          href="/admin"
          onClick={() => onNavigate?.()}
          className="block overflow-x-auto rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Image
            src="/brand/uvs-logo-landscape.png"
            width={1536}
            height={1024}
            alt="Universal Music Store admin home"
            priority
            unoptimized
            className="block h-28 w-auto max-w-[min(100%,260px)] object-contain object-left"
          />
        </Link>
        <p className="mt-1 text-[10px] font-medium uppercase tracking-widest text-slate-400">
          Store back office
        </p>
      </div>
      <nav
        data-lenis-prevent
        className="admin-sidebar-scrollbar min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pr-1"
      >
        {ADMIN_NAV_GROUPS.map((group) => {
          const visible = group.items.filter((item) => itemHasPermission(item, perms ?? []));
          if (visible.length === 0) return null;
          return (
            <div key={group.label} className="flex flex-col gap-1">
              <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {group.label}
              </p>
              {visible.map((item) => {
                const isActive = itemIsActive(item, pathname);
                const childItems = (item.children ?? []).filter((child) =>
                  itemHasPermission(child, perms ?? []),
                );
                const isExpanded = expanded[item.href] ?? isActive;
                return (
                  <div key={item.href} className="space-y-1">
                    <div className="flex items-center">
                      <Link
                        href={item.href}
                        onClick={() => onNavigate?.()}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-3 rounded-lg px-4 py-3 transition-all",
                          isActive ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:bg-slate-200",
                        )}
                      >
                        <span className="material-symbols-outlined">{item.icon}</span>
                        <span className="font-body truncate text-sm font-medium">{item.label}</span>
                      </Link>
                      {childItems.length > 0 ? (
                        <button
                          type="button"
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${item.label}`}
                          aria-expanded={isExpanded}
                          onClick={() => setExpanded((current) => ({ ...current, [item.href]: !isExpanded }))}
                          className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                        >
                          <span className="material-symbols-outlined text-lg transition-transform">{isExpanded ? "expand_less" : "expand_more"}</span>
                        </button>
                      ) : null}
                    </div>
                    {isExpanded && childItems.length > 0 ? (
                      <div className="ml-5 space-y-1 border-l border-slate-200 pl-3">
                        {childItems.map((child) => {
                          const childActive = itemIsActive(child, pathname);
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => onNavigate?.()}
                              aria-current={childActive ? "page" : undefined}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors",
                                childActive ? "bg-slate-200 font-semibold text-primary" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
                              )}
                            >
                              <span className="material-symbols-outlined text-base">{child.icon}</span>
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>
      {onOpenSearch ? (
        <button
          type="button"
          onClick={() => {
            onOpenSearch();
            onNavigate?.();
          }}
          className="mx-2 mb-1 flex items-center gap-3 rounded-lg px-4 py-2.5 text-left text-slate-500 transition-colors hover:bg-slate-200"
        >
          <span className="material-symbols-outlined text-xl">search</span>
          <span className="flex-1 font-body text-sm font-medium">
            Search pages
          </span>
          <kbd className="hidden rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-500 lg:inline-block">
            ⌘K
          </kbd>
        </button>
      ) : null}
      <div className="mt-auto flex flex-col gap-1 border-t border-slate-200 pt-4">
        <div className="px-2">
          <AdminProfilePreferencesDialog />
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex w-full items-center justify-start gap-3 px-4 py-3 text-left font-normal text-slate-500 hover:bg-slate-200"
        >
          <span className="material-symbols-outlined">logout</span>
          <span className="font-body text-sm font-medium">Logout</span>
        </Button>
      </div>
    </aside>
  );
}
