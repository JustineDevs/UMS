import { AdminBreadcrumbs, AdminPageShell, AdminSection, AuditTimeline } from "@/components/admin-console";
import { ChannelEventsTable } from "@/components/ChannelEventsTable";
import { fetchRecentChannelEvents } from "@/lib/channel-events-bridge";
import { requirePagePermission } from "@/lib/require-page-permission";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  await requirePagePermission("channels:manage");
  const events = await fetchRecentChannelEvents(80);

  return (
    <AdminPageShell
      title="Channel sync"
      subtitle="See recent messages from your sales channels (for example marketplaces or partners). Your integration partner sends updates here so you can confirm they arrived."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Channels" }]}
        />
      }
      inspector={<AuditTimeline title="Recent activity" />}
    >
      <details className="mb-8 max-w-3xl text-xs text-on-surface-variant">
          <summary className="cursor-pointer font-medium text-on-surface select-none">
            Details for IT or your developer
          </summary>
          <p className="mt-2 border-l-2 border-outline-variant/40 pl-3 leading-relaxed">
            Partners send updates to a dedicated inbound URL. Production setups should use a shared secret and
            verify the signed request body. Your developer can find the exact path and header names in the
            integration documentation for this project.
          </p>
        </details>
      <AdminSection title="Recent channel events" description="Signed updates received from connected sales channels.">
        <ChannelEventsTable initialEvents={events} />
      </AdminSection>
    </AdminPageShell>
  );
}
