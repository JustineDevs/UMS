import type { Metadata } from "next";
import Link from "next/link";
import {
  PageArticle,
  PageRoot,
  PageTOCItems,
  PageTOCTitle,
} from "fumadocs-ui/layouts/docs/page";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminBreadcrumbs } from "@/components/admin-console";
import { adminDocsInventory } from "@/config/admin-docs-inventory";
import { ADMIN_NAV_GROUPS, flattenAdminNavItems } from "@/config/admin-nav";
import { isEmailAllowedForGuideDemos } from "@/lib/admin-allowed-emails";
import { getAdminSession } from "@/lib/auth";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = {
  title: "Admin guide",
  description: "Fumadocs operator guide and route inventory for the store back office.",
};

const ROUTE_GROUP_PURPOSES: Record<string, string> = {
  Commerce: "The selling system: catalog, prices, stock, orders, checkout, and performance.",
  Customers: "Customer records, rewards, and customer-generated content.",
  Content: "Storefront structure, editorial content, publishing, and developer reference.",
  Operations: "People, connected hardware, channels, operator intake, and recovery work.",
  More: "Configuration, approvals, traceability, and sensitive staff actions.",
};

const routeGroups = ADMIN_NAV_GROUPS.map((group) => ({
  label: group.label,
  routes: flattenAdminNavItems(group.items).map((item) => [item.label, item.href] as const),
  purpose: ROUTE_GROUP_PURPOSES[group.label] ?? "Admin tasks for this area.",
}));

function RouteLinks({ routes }: { routes: readonly (readonly [string, string])[] }) {
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1">
      {routes.map(([label, href], index) => (
        <span key={`${label}:${href}`} className="inline-flex items-center gap-2">
          <Link className="text-primary underline-offset-4 hover:underline" href={href}>
            {label}
          </Link>
          {index < routes.length - 1 ? <span aria-hidden="true" className="text-muted-foreground">·</span> : null}
        </span>
      ))}
    </div>
  );
}

export default async function AdminDocsPage() {
  await requirePagePermission("dashboard:read");
  const session = await getAdminSession();
  const canAccessGuideDemos = isEmailAllowedForGuideDemos(session?.user?.email ?? null);

  return (
    <RootProvider>
      <DocsLayout
        tree={adminDocsInventory}
        nav={{ enabled: false }}
        searchToggle={{ enabled: false }}
        themeSwitch={{ enabled: false }}
        sidebar={{
          collapsible: true,
          banner: (
            <div className="px-2 pb-2 text-xs text-muted-foreground">
              Browse the live admin route inventory.
            </div>
          ),
        }}
        containerProps={{ className: "min-w-0 flex-1 bg-background" }}
      >
      <PageRoot
        className="mx-auto grid w-full max-w-[1440px] min-w-0 grid-cols-1 gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:px-10 lg:py-10 2xl:grid-cols-[minmax(0,1fr)_260px]"
        toc={{
          toc: [
            { url: "#overview", title: "Overview", depth: 2 },
            { url: "#ownership", title: "System ownership", depth: 2 },
            { url: "#route-inventory", title: "Route inventory", depth: 2 },
            { url: "#daily-operations", title: "Daily operations", depth: 2 },
            { url: "#governance", title: "Governance", depth: 2 },
            { url: "#training", title: "Training", depth: 2 },
          ],
        }}
      >
        <PageArticle className="min-w-0 max-w-none">
          <div className="mb-6 text-sm text-muted-foreground">
            <AdminBreadcrumbs items={[{ label: "Dashboard", href: "/admin" }, { label: "Admin guide" }]} />
          </div>
          <header className="mb-10 border-b pb-8">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline">Operator handbook</Badge>
              <Badge variant="secondary">Live route inventory</Badge>
            </div>
            <h1 className="mt-4 scroll-mt-20 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl" id="guide-title">
              Admin guide
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
              A task-first map of the store back office. Use the Fumadocs inventory on the left to jump directly to an operational screen.
            </p>
          </header>

          <div className="space-y-10">
            <section id="overview" className="scroll-mt-20 space-y-4">
              <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
              <div className="border-b pb-10">
                <h3 className="text-lg font-semibold">Start with the task, not the system</h3>
                <p className="mt-1 text-sm text-muted-foreground">The sidebar inventory mirrors the canonical admin navigation and keeps related actions together.</p>
                <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3 xl:divide-x">
                  <Link href="/admin" className="group sm:pr-6">
                    <p className="font-medium group-hover:text-primary">Store overview</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Sales, orders, stock, and operational health.</p>
                  </Link>
                  <Link href="/admin/build" className="group xl:px-6">
                    <p className="font-medium group-hover:text-primary">Build storefront</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Content, navigation, media, and publishing.</p>
                  </Link>
                  <Link href="/admin/settings/payments" className="group xl:pl-6">
                    <p className="font-medium group-hover:text-primary">Payments</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Provider connections and checkout readiness.</p>
                  </Link>
                </div>
              </div>
            </section>

            <section id="ownership" className="scroll-mt-20 space-y-4">
              <h2 className="text-2xl font-semibold tracking-tight">System ownership</h2>
              <div className="grid gap-6 border-b pb-10 md:grid-cols-2 md:divide-x">
                <div className="md:pr-6">
                  <Badge>Commerce engine</Badge>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">Products, variants, prices, inventory, orders, regions, and checkout are the selling system of record.</p>
                </div>
                <div className="md:pl-6">
                  <Badge variant="secondary">Platform tools</Badge>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">Build content, media, staff access, loyalty, campaigns, devices, workflows, and audit history coordinate work around commerce records.</p>
                </div>
              </div>
            </section>

            <section id="route-inventory" className="scroll-mt-20 space-y-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Route inventory</h2>
                <p className="mt-2 text-sm text-muted-foreground">This table is a readable summary; the Fumadocs sidebar is the complete navigable inventory.</p>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-32">Area</TableHead>
                      <TableHead className="min-w-64">Routes</TableHead>
                      <TableHead className="min-w-64">Use it for</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routeGroups.map((group) => (
                      <TableRow key={group.label}>
                        <TableCell className="align-top font-medium">{group.label}</TableCell>
                        <TableCell className="align-top"><RouteLinks routes={group.routes} /></TableCell>
                        <TableCell className="align-top text-muted-foreground">{group.purpose}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section id="daily-operations" className="scroll-mt-20 space-y-4">
              <h2 className="text-2xl font-semibold tracking-tight">Daily operations</h2>
              <ol className="list-decimal space-y-4 border-b pb-10 pl-5 text-sm leading-6 text-muted-foreground">
                <li><strong className="text-foreground">Start of day:</strong> open <Link className="text-primary underline-offset-4 hover:underline" href="/admin">Dashboard</Link> and review orders, stock, and connected-channel health.</li>
                <li><strong className="text-foreground">Order work:</strong> use <Link className="text-primary underline-offset-4 hover:underline" href="/admin/orders">Orders</Link> for detail, fulfillment, receipts, invoices, and payment recovery.</li>
                <li><strong className="text-foreground">Stock work:</strong> use <Link className="text-primary underline-offset-4 hover:underline" href="/admin/inventory">Inventory</Link> for adjustments and availability checks; confirm the variant before mutating stock.</li>
                <li><strong className="text-foreground">Storefront work:</strong> use <Link className="text-primary underline-offset-4 hover:underline" href="/admin/build">Build</Link> for page structure and editorial content, not commerce records.</li>
              </ol>
            </section>

            <section id="governance" className="scroll-mt-20 space-y-4">
              <h2 className="text-2xl font-semibold tracking-tight">Governance</h2>
              <div className="grid gap-6 border-b pb-10 sm:grid-cols-3 sm:divide-x">
                <div className="sm:pr-6"><p className="font-medium">Permissions</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Roles determine which routes and mutations are available.</p></div>
                <div className="sm:px-6"><p className="font-medium">Workflow</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Use approvals and queues for sensitive operational changes.</p></div>
                <div className="sm:pl-6"><p className="font-medium">Audit log</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Trace staff actions and investigate changes from one source.</p></div>
              </div>
            </section>

            <section id="training" className="scroll-mt-20 space-y-4">
              <h2 className="text-2xl font-semibold tracking-tight">Training</h2>
              <div className="border-b pb-10 text-sm leading-6 text-muted-foreground">
                {canAccessGuideDemos ? (
                  <p>Use the <Link className="text-primary underline-offset-4 hover:underline" href="/guide-demos/index.html">training demo index</Link> for guided operator walkthroughs.</p>
                ) : (
                  <p>Interactive training demos are limited to addresses configured in <code className="rounded bg-muted px-1.5 py-0.5 text-xs">ADMIN_ALLOWED_EMAILS</code>. Ask an administrator if you need access.</p>
                )}
              </div>
            </section>
          </div>
        </PageArticle>

        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-4">
            <div className="border-l pl-5">
              <PageTOCTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">On this page</PageTOCTitle>
              <div className="my-3 border-t" />
              <PageTOCItems className="space-y-2 text-sm" />
            </div>
            <p className="px-1 text-xs leading-5 text-muted-foreground">The left inventory is generated from the same navigation data used by the admin sidebar.</p>
          </div>
        </aside>
      </PageRoot>
      </DocsLayout>
    </RootProvider>
  );
}
