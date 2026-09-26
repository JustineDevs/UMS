"use client";

import {
  Bell,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileText,
  LockKeyhole,
  MapPin,
  Package,
  Settings2,
  ShieldCheck,
  Star,
  Ticket,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AccountRoute = {
  href: string;
  label: string;
  icon: typeof UserRound;
};

const groups: Array<{ label: string; items: AccountRoute[] }> = [
  {
    label: "My Account",
    items: [
      { href: "/account/profile", label: "Profile", icon: UserRound },
      { href: "/account/banks-cards", label: "Banks & Cards", icon: CreditCard },
      { href: "/account/addresses", label: "Addresses", icon: MapPin },
      { href: "/account/password", label: "Change Password", icon: LockKeyhole },
      { href: "/account/privacy", label: "Privacy Settings", icon: ShieldCheck },
      { href: "/account/notifications", label: "Notification Settings", icon: Bell },
      { href: "/account/preferences", label: "Order Settings", icon: Settings2 },
    ],
  },
  {
    label: "My Purchase",
    items: [
      { href: "/account/orders", label: "Purchase History", icon: Package },
      { href: "/account/orders?status=pending_payment", label: "To Pay", icon: CircleDollarSign },
      { href: "/account/orders?status=pending", label: "To Ship", icon: FileText },
      { href: "/account/orders?status=shipped", label: "To Receive", icon: Package },
      { href: "/account/orders?status=delivered", label: "Completed", icon: FileText },
      { href: "/account/orders?status=cancelled", label: "Cancelled", icon: FileText },
      { href: "/account/orders?status=returned", label: "Returns", icon: FileText },
    ],
  },
  {
    label: "More",
    items: [
      { href: "/account/notifications", label: "Notifications", icon: Bell },
      { href: "/account/vouchers", label: "My Vouchers", icon: Ticket },
      { href: "/account/loyalty", label: "My Coins", icon: Star },
    ],
  },
];

function isActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  return pathname === path || (path !== "/account/profile" && pathname.startsWith(`${path}/`));
}

export function AccountRouteNav() {
  const pathname = usePathname();
  const currentPath = pathname ?? "";

  return (
    <nav aria-label="Account navigation" className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-xs font-bold uppercase tracking-[0.16em] text-primary">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(currentPath, item.href);
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-primary/10 font-semibold text-primary" : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary"}`}
                >
                  <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">{item.label}</span>
                  <ChevronRight className="size-4 opacity-0 transition group-hover:opacity-60" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
