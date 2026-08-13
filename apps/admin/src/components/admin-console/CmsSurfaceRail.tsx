import Link from "next/link";

const groups = [
  {
    label: "Build",
    links: [
      ["/admin/cms/builder", "Builder"],
    ],
  },
  {
    label: "Pages",
    links: [
      ["/admin/cms/pages", "Pages"],
      ["/admin/cms/site-map", "Site map"],
      ["/admin/cms/navigation", "Navigation"],
      ["/admin/cms/announcement", "Announcement"],
      ["/admin/cms/categories", "Categories"],
      ["/admin/cms/media", "Media"],
    ],
  },
  {
    label: "Publishing",
    links: [
      ["/admin/cms/blog", "Blog"],
      ["/admin/cms/forms", "Submissions"],
      ["/admin/cms/redirects", "Redirects"],
      ["/admin/cms/experiments", "Experiments"],
    ],
  },
  { label: "Commerce", links: [["/admin/cms/commerce", "Product lookup"]] },
] as const;

export function CmsSurfaceRail() {
  return (
    <aside className="h-fit rounded-xl border border-border/70 bg-card p-2 shadow-sm">
      <div className="px-3 pb-2 pt-2">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Content tools
        </p>
      </div>
      <nav aria-label="Content tools" className="grid gap-3">
        {groups.map((group) => (
          <div key={group.label} className="grid gap-0.5">
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
              {group.label}
            </p>
            {group.links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
