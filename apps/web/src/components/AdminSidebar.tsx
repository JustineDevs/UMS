"use client";

import NextImage from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { signOut } from "@/lib/auth-actions";
import {
  staffHasPermission,
  staffPermissionListForSession,
} from "@universal-music-store/platform-data";
import { Button } from "@universal-music-store/ui";
import { ADMIN_NAV_GROUPS, type AdminNavItem } from "@/config/admin-nav";
import { AdminProfilePreferencesDialog } from "@/components/AdminProfilePreferencesDialog";
import {
  Archive,
  BarChart3,
  BookOpen,
  Calculator,
  Boxes,
  ChevronDown,
  ChevronUp,
  CloudSync,
  CreditCard,
  FileCheck2,
  FileText,
  Headphones,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageCircle,
  MonitorSmartphone,
  PanelTop,
  PanelLeftClose,
  PanelLeftOpen,
  RadioTower,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Truck,
  UserRound,
  UsersRound,
  WalletCards,
  Workflow,
  type LucideIcon,
} from "lucide-react";

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

const NAV_ICONS: Record<string, LucideIcon> = {
  account_balance_wallet: WalletCards,
  account_tree: Workflow,
  admin_panel_settings: ShieldCheck,
  article: FileText,
  badge: UserRound,
  bar_chart: BarChart3,
  campaign: Megaphone,
  chat: MessageCircle,
  cloud_sync: CloudSync,
  dashboard: LayoutDashboard,
  devices: MonitorSmartphone,
  dock: Store,
  fact_check: FileCheck2,
  groups: UsersRound,
  group: UserRound,
  hub: RadioTower,
  inventory_2: Boxes,
  local_shipping: Truck,
  loyalty: Headphones,
  menu_book: BookOpen,
  payments: CreditCard,
  perm_media: ImageIcon,
  rate_review: MessageCircle,
  receipt_long: ReceiptText,
  settings: Settings,
  shopping_bag: ShoppingBag,
  shopping_cart: ShoppingCart,
  pos: Calculator,
  storefront: Store,
  tune: SlidersHorizontal,
  web: PanelTop,
};

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = NAV_ICONS[name] ?? Archive;
  return <Icon aria-hidden="true" className={cn("shrink-0", className)} strokeWidth={1.8} />;
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
  /** Compact desktop rail state, matching the application-shell navigation pattern. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export function AdminSidebar({
  mobileOpen = true,
  onNavigate,
  onOpenSearch,
  localAuthBypass = false,
  collapsed = false,
  onToggleCollapsed,
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
        "fixed left-0 top-0 z-50 flex h-dvh flex-col gap-2 overflow-hidden border-r border-slate-200 bg-slate-50 px-3 py-4 transition-[width,transform] duration-200 ease-out",
        collapsed ? "w-[4.5rem]" : "w-[min(20rem,max(0px,calc(100vw_-_1rem)))] lg:w-80",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
    >
      <div className={cn("flex items-start gap-2 px-1 py-2", collapsed ? "justify-center" : "justify-between")}>
        <Link
          href="/admin"
          onClick={() => onNavigate?.()}
          aria-label="Universal Music Store admin home"
          className={cn("block min-w-0 overflow-hidden rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", collapsed ? "w-10" : "flex-1")}
        >
          <NextImage
            src="/brand/uvs-logo-landscape.png"
            width={1536}
            height={1024}
            alt="Universal Music Store admin home"
            priority
            unoptimized
            className={cn("block w-auto object-contain object-left", collapsed ? "h-10 max-w-10" : "h-14 max-w-[170px]")}
          />
        </Link>
        {onToggleCollapsed ? <Button type="button" variant="ghost" size="icon" onClick={onToggleCollapsed} className="mt-1 shrink-0 text-slate-500 hover:bg-slate-200 hover:text-slate-900" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={collapsed}>{collapsed ? <PanelLeftOpen aria-hidden="true" className="size-4" /> : <PanelLeftClose aria-hidden="true" className="size-4" />}</Button> : null}
        {!collapsed ? <p className="absolute left-4 top-[4.7rem] text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">Store back office</p> : null}
      </div>
      <nav
        data-lenis-prevent
        className="admin-sidebar-scrollbar min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pr-1"
      >
        {ADMIN_NAV_GROUPS.map((group) => {
          const visible = group.items.filter((item) => itemHasPermission(item, perms ?? []));
          if (visible.length === 0) return null;
          return (
            <div key={group.label} className="flex flex-col gap-0.5">
              {!collapsed ? <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{group.label}</p> : <div className="h-3" aria-hidden="true" />}
              {visible.map((item) => {
                const isActive = itemIsActive(item, pathname);
                const childItems = (item.children ?? []).filter((child) =>
                  itemHasPermission(child, perms ?? []),
                );
                const isExpanded = expanded[item.href] ?? isActive;
                return (
                  <div key={`${group.label}:${item.label}:${item.href}`} className="space-y-1">
                    <div className="flex items-center">
                      <Link
                        href={item.href}
                        onClick={() => onNavigate?.()}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3.5 py-2.5 transition-[background-color,color,box-shadow]",
                          isActive ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:bg-slate-200",
                        )}
                      >
                        <NavIcon name={item.icon} className="size-[18px]" />
                        <span className={cn("min-w-0 whitespace-nowrap font-body text-sm font-medium", collapsed && "sr-only")}>{item.label}</span>
                      </Link>
                      {childItems.length > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${item.label}`}
                          aria-expanded={isExpanded}
                          onClick={() => setExpanded((current) => ({ ...current, [item.href]: !isExpanded }))}
                          className="mr-2 shrink-0 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                        >
                          {isExpanded ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
                        </Button>
                      ) : null}
                    </div>
                    {isExpanded && childItems.length > 0 && !collapsed ? (
                      <div className="ml-5 space-y-1 border-l border-slate-200 pl-3">
                        {childItems.map((child) => {
                          const childActive = itemIsActive(child, pathname);
                          return (
                            <Link
                              key={`${group.label}:${item.label}:${child.label}:${child.href}`}
                              href={child.href}
                              onClick={() => onNavigate?.()}
                              aria-current={childActive ? "page" : undefined}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors",
                                childActive ? "bg-slate-200 font-semibold text-primary" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
                              )}
                            >
                                <NavIcon name={child.icon} className="size-4" />
                                <span className="min-w-0 truncate">{child.label}</span>
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
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            onOpenSearch();
            onNavigate?.();
          }}
          className={cn("mx-1 mb-1 flex h-auto items-center gap-3 rounded-lg py-2.5 text-left font-normal text-slate-500 hover:bg-slate-200", collapsed ? "justify-center px-2" : "px-3")}
        >
          <Search aria-hidden="true" className="size-5 shrink-0" />
          <span className={cn("flex-1 font-body text-sm font-medium", collapsed && "sr-only")}>
            Search pages
          </span>
          <kbd className="hidden rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-500 lg:inline-block">
            ⌘K
          </kbd>
        </Button>
      ) : null}
      <div className="mt-auto flex flex-col gap-1 border-t border-slate-200 pt-3">
        <div className="min-w-0">
          <AdminProfilePreferencesDialog />
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => signOut({ callbackUrl: "/" })}
          className={cn("min-h-10 flex w-full items-center gap-3 rounded-lg py-2.5 text-left font-normal text-slate-500 hover:bg-slate-200", collapsed ? "justify-center px-2" : "justify-start px-4")}
        >
          <LogOut aria-hidden="true" className="size-[18px] shrink-0" />
          <span className={cn("font-body text-sm font-medium", collapsed && "sr-only")}>Logout</span>
        </Button>
      </div>
    </aside>
  );
}
