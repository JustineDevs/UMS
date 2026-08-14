import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminBreadcrumbs, AdminPageShell } from "@/components/admin-console";
import {
  ADMIN_COMMAND_CMS_GROUPS,
  ADMIN_NAV_GROUPS,
  type AdminNavItem,
} from "@/config/admin-nav";
import { isEmailAllowedForGuideDemos } from "@/lib/admin-allowed-emails";
import { authOptions } from "@/lib/auth";
import { GUIDE_DEMO_CATALOG } from "@/lib/guide-demos-catalog";
import { requirePagePermission } from "@/lib/require-page-permission";
import { getServerSession } from "next-auth/next";

export const metadata: Metadata = {
  title: "Admin guide",
  description:
    "Staff admin guide: sidebar navigation, daily tasks, commerce versus website content, and permissions.",
};

const tocBase = [
  { href: "#welcome", label: "Overview" },
  { href: "#ownership", label: "Who owns what" },
  { href: "#sidebar", label: "Sidebar and search" },
  { href: "#navigation-map", label: "Navigation map" },
  { href: "#daily-tasks", label: "Common tasks" },
  { href: "#operations", label: "Operations" },
  { href: "#interactive-demos", label: "Interactive demos" },
  { href: "#important-notes", label: "Important notes" },
] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6"
    >
      <h2 className="font-headline text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        {title}
      </h2>
      <div className="mt-4 space-y-4 font-body text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function Subheading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-6 text-base font-semibold text-foreground first:mt-0">
      {children}
    </h3>
  );
}

function GuideLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
    >
      {children}
    </Link>
  );
}

function GuideCard({
  href,
  eyebrow,
  title,
  children,
}: {
  href: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border/70 bg-background p-4 transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary/75">
        {eyebrow}
      </p>
      <h3 className="mt-2 font-semibold text-foreground group-hover:text-primary">
        {title}
      </h3>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{children}</p>
    </Link>
  );
}

function NavTree({ items }: { items: readonly AdminNavItem[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item) => (
        <li key={item.href}>
          <GuideLink href={item.href}>{item.label}</GuideLink>
          {item.children?.length ? (
            <ul className="ml-4 mt-1 space-y-1 border-l border-border/70 pl-3 text-sm">
              <NavTree items={item.children} />
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default async function AdminDocsPage() {
  await requirePagePermission("dashboard:read");
  const session = await getServerSession(authOptions);
  const canAccessGuideDemos = isEmailAllowedForGuideDemos(
    session?.user?.email ?? null,
  );
  const toc = canAccessGuideDemos
    ? tocBase
    : tocBase.filter((item) => item.href !== "#interactive-demos");

  const tocNav = (
    <nav
      aria-label="On this page"
      className="xl:sticky xl:top-6 rounded-xl border border-border/70 bg-card p-4 shadow-sm"
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        On this page
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {toc.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <AdminPageShell
      title="Admin guide"
      subtitle="Operator guide for owners and managers: where to go for each task, what the commerce system owns versus website content, and how permissions shape the menu."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[
            { label: "Dashboard", href: "/admin" },
            { label: "Admin guide" },
          ]}
        />
      }
      inspector={tocNav}
    >
      <div className="mx-auto max-w-4xl space-y-6 pb-16">
        <Section id="welcome" title="Overview">
          <p className="max-w-3xl text-base leading-7 text-foreground/80">
            <strong className="text-foreground">Staff admin console.</strong>{" "}
            Use this guide to move from onboarding to daily operations without
            guessing which system owns a change.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <GuideCard
              href="/admin"
              eyebrow="Start here"
              title="Store overview"
            >
              Check sales, orders, inventory, traffic, and connected channels.
            </GuideCard>
            <GuideCard
              href="/admin/cms/builder"
              eyebrow="Content"
              title="Storefront Builder"
            >
              Edit homepage sections, global navigation, footer, and modular
              content in one workspace.
            </GuideCard>
            <GuideCard
              href="/admin/settings/payments"
              eyebrow="Settings"
              title="Payments"
            >
              Connect merchant accounts and review provider capability status
              before enabling checkout.
            </GuideCard>
          </div>
          <div
            className="mt-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 text-foreground"
            role="note"
          >
            <p className="font-semibold">Source-of-truth rule</p>
            <p className="mt-1 text-muted-foreground">
              Products, prices, stock, orders, and checkout are commerce data.
              The CMS owns page structure, editorial content, media, navigation,
              and publishing controls.
            </p>
          </div>
        </Section>

        <Section id="ownership" title="Who owns what">
          <p>
            Some data lives in the{" "}
            <strong className="text-foreground">commerce engine</strong> (your
            store&apos;s product catalog, prices, orders, inventory positions,
            regions, and checkout configuration). That is the system of record
            for selling.
          </p>
          <p className="mt-4">
            Other data lives in{" "}
            <strong className="text-foreground">platform tools</strong>{" "}
            connected to this admin: staff access, CMS content and media,
            loyalty, campaigns, devices, channels, chat orders, workflows, and
            audit history. These tools coordinate work around commerce records;
            they do not create a second product or order ledger.
          </p>
        </Section>

        <Section id="sidebar" title="How to use the sidebar">
          <p>
            <strong className="text-primary">
              Use the left sidebar to move by task.
            </strong>{" "}
            The sidebar is the main navigation of the admin, and it only shows
            areas your role is allowed to access.
          </p>
          <p className="mt-4">
            Press <strong className="text-primary">Ctrl+K</strong> (Windows) or{" "}
            <strong className="text-primary">Cmd+K</strong> (Mac), or use{" "}
            <strong className="text-primary">Search pages</strong> in the
            sidebar, to jump to any screen by name.
          </p>
          <Subheading>Sidebar reference (matches the live menu)</Subheading>
          <div className="grid gap-5 rounded-xl border border-border/70 bg-background p-5 sm:grid-cols-2">
            {ADMIN_NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </p>
                <NavTree items={group.items} />
              </div>
            ))}
          </div>
        </Section>

        <Section id="navigation-map" title="Where do I go?">
          <p>
            Use the table below by{" "}
            <strong className="text-primary">business intent</strong>. Links
            match the real sidebar; group names below are for learning, not
            separate menus.
          </p>
          <div className="mt-6 overflow-x-auto rounded-xl border border-outline-variant/20">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant/20 bg-surface-container-lowest">
                  <th className="px-4 py-3 font-headline text-xs font-bold uppercase tracking-wider text-primary">
                    Group
                  </th>
                  <th className="px-4 py-3 font-headline text-xs font-bold uppercase tracking-wider text-primary">
                    What belongs here
                  </th>
                  <th className="px-4 py-3 font-headline text-xs font-bold uppercase tracking-wider text-primary">
                    Business explanation
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                <tr>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-primary">
                    Commerce
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    <Link href="/admin" className="text-primary underline">
                      Dashboard
                    </Link>
                    ,{" "}
                    <Link
                      href="/admin/catalog"
                      className="text-primary underline"
                    >
                      Products
                    </Link>
                    ,{" "}
                    <Link
                      href="/admin/inventory"
                      className="text-primary underline"
                    >
                      Inventory
                    </Link>
                    ,{" "}
                    <Link
                      href="/admin/orders"
                      className="text-primary underline"
                    >
                      Orders
                    </Link>
                    ,{" "}
                    <Link href="/admin/pos" className="text-primary underline">
                      POS
                    </Link>
                    ,{" "}
                    <Link
                      href="/admin/analytics"
                      className="text-primary underline"
                    >
                      Analytics
                    </Link>
                    ,{" "}
                    <Link href="/admin/crm" className="text-primary underline">
                      CRM
                    </Link>
                    ,{" "}
                    <Link
                      href="/admin/settings/payments"
                      className="text-primary underline"
                    >
                      Payments
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    Monitor sales, manage the catalog, check stock, review
                    orders, run in-store sales, read business metrics, view
                    customers, and inspect payment and region setup.
                  </td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-primary">
                    Team and growth
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    <Link
                      href="/admin/users"
                      className="text-primary underline"
                    >
                      Users
                    </Link>
                    ,{" "}
                    <Link
                      href="/admin/loyalty"
                      className="text-primary underline"
                    >
                      Loyalty
                    </Link>
                    ,{" "}
                    <Link
                      href="/admin/campaigns"
                      className="text-primary underline"
                    >
                      Campaigns
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    Staff records and access, customer rewards, and marketing
                    execution.
                  </td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-primary">
                    Operations
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    <Link
                      href="/admin/devices"
                      className="text-primary underline"
                    >
                      Devices
                    </Link>
                    ,{" "}
                    <Link
                      href="/admin/channels"
                      className="text-primary underline"
                    >
                      Channels
                    </Link>
                    ,{" "}
                    <Link
                      href="/admin/chat-orders"
                      className="text-primary underline"
                    >
                      Chat orders
                    </Link>
                    ,{" "}
                    <Link
                      href="/admin/offline-queue"
                      className="text-primary underline"
                    >
                      Offline queue
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    Register hardware, review channel events, process chat or
                    manual intake, and clear POS sync when the network was down.
                  </td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-primary">
                    Website
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    <GuideLink href="/admin/cms/builder">Builder</GuideLink>,{" "}
                    <GuideLink href="/admin/cms/builder">Builder</GuideLink>,{" "}
                    <GuideLink href="/admin/cms/pages">Pages</GuideLink>,{" "}
                    <GuideLink href="/admin/cms/navigation">
                      Navigation
                    </GuideLink>
                    , <GuideLink href="/admin/cms/media">Media</GuideLink>,{" "}
                    <GuideLink href="/admin/cms/blog">Blog</GuideLink>,{" "}
                    <GuideLink href="/admin/reviews">Reviews</GuideLink>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    Build the storefront, manage page structure and publishing,
                    connect media and commerce lookup, then moderate customer
                    reviews.
                  </td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-primary">
                    Administration
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    <GuideLink href="/admin/users">Users</GuideLink>,{" "}
                    <GuideLink href="/admin/roles">
                      Roles &amp; permissions
                    </GuideLink>
                    ,{" "}
                    <GuideLink href="/admin/settings/payments">
                      Payments
                    </GuideLink>
                    , <GuideLink href="/admin/workflow">Workflow</GuideLink>,{" "}
                    <GuideLink href="/admin/audit">Audit log</GuideLink>,{" "}
                    <GuideLink href="/admin/docs">Admin guide</GuideLink>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    Control access, configure connected operations, review
                    workflow state, and trace sensitive staff actions.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <Subheading>
            For catalog and order operations, think commerce first
          </Subheading>
          <p>
            Products, prices, orders, inventory, and payment-region setup are
            tied to the commerce system rather than the CMS layer.
          </p>
          <Subheading>For website updates, think content first</Subheading>
          <p>
            Homepage payload and CMS sections such as pages, navigation,
            announcements, blog, media, forms, redirects, and experiments are
            managed in the content side of admin.
          </p>
        </Section>

        <Section id="daily-tasks" title="Daily tasks">
          <Subheading>Most common tasks</Subheading>
          <ol className="list-decimal space-y-3 pl-5 text-on-surface-variant">
            <li>
              <strong className="text-on-surface">
                Check today&apos;s performance:
              </strong>{" "}
              open{" "}
              <Link href="/admin" className="text-primary underline">
                Dashboard
              </Link>{" "}
              for overview metrics, recent orders, and stock alerts.
            </li>
            <li>
              <strong className="text-on-surface">
                Review or fulfill an order:
              </strong>{" "}
              open{" "}
              <Link href="/admin/orders" className="text-primary underline">
                Orders
              </Link>
              , then select an order to view details and fulfillment actions.
            </li>
            <li>
              <strong className="text-on-surface">
                Update stock visibility:
              </strong>{" "}
              open{" "}
              <Link href="/admin/inventory" className="text-primary underline">
                Inventory
              </Link>{" "}
              and refresh the latest variant stock data.
            </li>
            <li>
              <strong className="text-on-surface">Sell in person:</strong> open{" "}
              <Link href="/admin/pos" className="text-primary underline">
                POS
              </Link>{" "}
              for lookup, cart, draft order, and sale completion flows.
            </li>
            <li>
              <strong className="text-on-surface">
                Update homepage content:
              </strong>{" "}
              open{" "}
              <Link
                href="/admin/cms/builder"
                className="text-primary underline"
              >
                Homepage
              </Link>{" "}
              for the homepage payload editor.
            </li>
            <li>
              <strong className="text-on-surface">Edit website content:</strong>{" "}
              open{" "}
              <Link href="/admin/cms" className="text-primary underline">
                Content workspace
              </Link>{" "}
              for pages, menus, announcement bar, categories, media, blog,
              forms, redirects, experiments, and commerce lookup for authors.
            </li>
          </ol>
        </Section>

        <Section id="operations" title="Operations at a glance">
          <Subheading>POS</Subheading>
          <p>
            The POS area supports lookup, cart building, draft order flow, sale
            commit, suggestions, offline queue behavior, and optional terminal
            printing paths.
          </p>
          <Subheading>Orders</Subheading>
          <p>
            The orders area includes list and detail views; the detail page
            includes fulfillment actions and shipment-related tools.
          </p>
          <Subheading>Inventory</Subheading>
          <p>
            Inventory is the operational view for stock levels, movement
            history, adjustments, and availability checks. Confirm the location
            and variant before making a stock mutation.
          </p>
          <Subheading>Products</Subheading>
          <p>
            Products and catalog media are commerce-backed. Use the catalog
            editor for product identity, pricing, variants, inventory
            references, and media; use the CMS for editorial placement and page
            content.
          </p>
          <Subheading>Payments, invoices, and receipts</Subheading>
          <p>
            Payment settings controls merchant connections and provider
            capabilities. Payment attempts, invoices, receipts, refunds, and
            reconciliation remain operational records and require the
            permissions shown by your role.
          </p>
          <Subheading>Users, roles, and audit</Subheading>
          <p>
            Users are the staff identity record. Roles define permissions; the
            audit log records sensitive actions. Do not share accounts or use a
            broader role to bypass a missing permission.
          </p>
          <Subheading>Content hub sections</Subheading>
          <ul className="mt-2 space-y-2 text-on-surface-variant">
            {ADMIN_COMMAND_CMS_GROUPS.flatMap((g) =>
              g.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="font-medium text-primary underline decoration-primary/30 underline-offset-2"
                  >
                    {item.label}
                  </Link>
                </li>
              )),
            )}
          </ul>
          {canAccessGuideDemos ? (
            <>
              <Subheading>Training demos</Subheading>
              <p>
                Open the{" "}
                <Link
                  href="/guide-demos/index.html"
                  className="font-semibold text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
                >
                  demo index
                </Link>{" "}
                for static HTML simulators: fake browser chrome, sidebar that
                matches this admin, mock data only, requestAnimationFrame cursor
                paths, captions, optional Web Speech, pause, skip, speed, and
                presentation or manual stepping. Access requires your email in{" "}
                <code className="rounded bg-surface-container px-1 py-0.5 text-xs">
                  ADMIN_ALLOWED_EMAILS
                </code>
                .
              </p>
            </>
          ) : (
            <>
              <Subheading>Training demos</Subheading>
              <p className="text-on-surface-variant">
                Interactive HTML demos are limited to addresses configured in{" "}
                <code className="rounded bg-surface-container px-1 py-0.5 text-xs">
                  ADMIN_ALLOWED_EMAILS
                </code>
                . Ask your administrator if you need access.
              </p>
            </>
          )}
        </Section>

        {canAccessGuideDemos ? (
          <Section
            id="interactive-demos"
            title="Interactive demos (safe simulator)"
          >
            <p>
              Each link opens a new tab. Demos are deterministic and offline
              friendly. They explain how staff work in admin while commerce
              truth stays in your commerce engine and customer-facing pages
              reflect content and storefront settings separately.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {GUIDE_DEMO_CATALOG.map((d) => (
                <a
                  key={d.key}
                  href={`/guide-demos/${d.file}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-outline-variant/25 bg-surface-container-lowest/90 p-4 shadow-sm transition hover:border-primary/40"
                >
                  <p className="font-headline text-sm font-bold text-primary">
                    {d.title}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    <span className="font-semibold text-on-surface">
                      Audience:
                    </span>{" "}
                    {d.audience}
                  </p>
                  <p className="mt-2 text-xs text-on-surface-variant">
                    <span className="font-semibold text-on-surface">
                      Outcome:
                    </span>{" "}
                    {d.outcome}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
                    {d.summary}
                  </p>
                </a>
              ))}
            </div>
          </Section>
        ) : null}

        <Section id="important-notes" title="Important notes">
          <div
            className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-on-surface"
            role="alert"
          >
            <p className="font-semibold text-primary">
              Permissions and protected actions
            </p>
            <p className="mt-2 text-on-surface-variant">
              The sidebar is permission-filtered. Read, create, update, delete,
              export, payment, workflow, and device actions can have separate
              permissions. If a control is not visible, request the appropriate
              role assignment rather than sharing credentials.
            </p>
          </div>
          <p className="mt-6 text-on-surface-variant">
            For technical setup (servers, domains, integrations), rely on your
            development or IT partner. This guide stays focused on day-to-day
            use of the back office.
          </p>
        </Section>
      </div>
    </AdminPageShell>
  );
}
