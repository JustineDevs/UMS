"use client";

import {
  Bell,
  ChevronRight,
  CreditCard,
  MapPin,
  Package,
  Settings2,
  ShieldCheck,
  Ticket,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
      { href: "/account/banks-cards", label: "Payment Methods", icon: CreditCard },
      { href: "/account/addresses", label: "Addresses", icon: MapPin },
      { href: "/account/privacy", label: "Privacy Settings", icon: ShieldCheck },
      { href: "/account/notifications", label: "Notification Settings", icon: Bell },
      { href: "/account/preferences", label: "Order Settings", icon: Settings2 },
    ],
  },
  {
    label: "My Purchase",
    items: [
      { href: "/account/orders", label: "Purchase History", icon: Package },
    ],
  },
  {
    label: "More",
    items: [
      { href: "/account/notifications/order", label: "Order Updates", icon: Bell },
      { href: "/account/notifications/promotions", label: "Promotions", icon: Ticket },
      { href: "/account/vouchers", label: "My Vouchers", icon: Ticket },
    ],
  },
];

function isActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  const hasNestedRoutes = path !== "/account/profile" && path !== "/account/notifications";
  return pathname === path || (hasNestedRoutes && pathname.startsWith(`${path}/`));
}

export function AccountRouteNav() {
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const activeGroup = groups.find((group) =>
    group.items.some((item) => isActive(currentPath, item.href)),
  )?.label;
  const [openGroup, setOpenGroup] = useState(activeGroup ?? groups[0].label);

  useEffect(() => {
    if (activeGroup) setOpenGroup(activeGroup);
  }, [activeGroup]);

  return (
    <nav aria-label="Account navigation" className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <button
            type="button"
            className="flex min-h-10 w-full items-center justify-between px-3 text-left text-xs font-bold uppercase tracking-[0.16em] text-primary"
            aria-expanded={openGroup === group.label}
            onClick={() => setOpenGroup((current) => current === group.label ? "" : group.label)}
          >
            <span>{group.label}</span>
            <ChevronRight className={`size-4 transition-transform ${openGroup === group.label ? "rotate-90" : ""}`} aria-hidden="true" />
          </button>
          <div className={`${openGroup === group.label ? "block" : "hidden"} space-y-1`}>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(currentPath, item.href);
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition focus:outline-2 focus:outline-solid focus:outline-offset-2 focus:outline-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary ${active ? "bg-surface-container-high font-semibold text-primary" : "bg-transparent text-on-surface-variant hover:bg-surface-container-low hover:text-primary"}`}
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
