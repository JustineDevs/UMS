"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = [
  {
    label: "Build",
    links: [
      { href: "/admin/cms/builder", label: "Builder" },
    ],
  },
  {
    label: "Pages",
    links: [
      { href: "/admin/cms/pages", label: "Pages" },
      { href: "/admin/cms/site-map", label: "Site map" },
      { href: "/admin/cms/navigation", label: "Navigation" },
      { href: "/admin/cms/announcement", label: "Announcement" },
      { href: "/admin/cms/categories", label: "Categories" },
      { href: "/admin/cms/media", label: "Media" },
    ],
  },
  {
    label: "Publishing",
    links: [
      { href: "/admin/cms/blog", label: "Blog" },
      { href: "/admin/cms/forms", label: "Forms" },
      { href: "/admin/cms/redirects", label: "Redirects" },
      { href: "/admin/cms/experiments", label: "Experiments" },
    ],
  },
  {
    label: "Commerce",
    links: [{ href: "/admin/cms/commerce", label: "Product lookup" }],
  },
] as const;

export function AdminCmsSectionNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Content sections"
      className="flex flex-wrap gap-1 border-b border-outline-variant/15 bg-white/90 px-4 py-2 lg:px-8"
    >
      {GROUPS.map((group) => (
        <div
          key={group.label}
          className="flex items-center gap-1 border-r border-outline-variant/20 pr-2 last:border-r-0"
        >
          <span className="px-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">
            {group.label}
          </span>
          {group.links.map((l) => {
            const active =
              l.href === "/admin/cms/builder"
                ? pathname === "/admin/cms/builder" || pathname === "/admin/cms"
                : pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={
                  active
                    ? "rounded-md bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                    : "rounded-md px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:bg-surface-container-low"
                }
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
