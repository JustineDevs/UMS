import { AdminBreadcrumbs, AdminPageShell, AuditTimeline } from "@/components/admin-console";
import { ChatIntakeForm } from "@/components/ChatIntakeForm";
import { ChatOrdersWorkspace } from "@/components/ChatOrdersWorkspace";
import { fetchRecentChatIntake } from "@/lib/chat-intake-bridge";
import { getMedusaAdminDraftOrderEditUrl } from "@/lib/medusa-catalog-bridge";
import { requirePagePermission } from "@/lib/require-page-permission";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ChatOrdersPage() {
  await requirePagePermission("chat_orders:manage");
  const rows = await fetchRecentChatIntake(80);

  return (
    <AdminPageShell
      title="Chat orders"
      subtitle="Capture orders from chat or phone, attach real catalog lines, and open draft orders in your store when the system is connected."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Chat orders" }]}
        />
      }
      inspector={<AuditTimeline title="Recent activity" />}
    >
      <details className="mb-8 max-w-3xl text-xs text-on-surface-variant">
        <summary className="cursor-pointer font-medium text-on-surface select-none">
          Setup for IT or your developer
        </summary>
        <p className="mt-2 border-l-2 border-outline-variant/40 pl-3 leading-relaxed">
          Automated systems can send orders to the chat intake endpoint using an approved staff session or
          internal key. Each line must reference a real product variant from your catalog.
        </p>
      </details>
      <section className="mb-10 max-w-xl">
        <ChatIntakeForm />
      </section>
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["Total tickets", rows.length],
          ["Pending", rows.filter((row) => row.status.toLowerCase().includes("pending")).length],
          ["Settled", rows.filter((row) => row.payment_status === "settled").length],
        ].map(([label, value]) => (
          <Card key={String(label)} size="sm"><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><p className="text-2xl tabular-nums">{value}</p></CardContent></Card>
        ))}
      </section>
      <ChatOrdersWorkspace rows={rows.map((r) => ({
        ...r,
        draftHref: r.medusa_draft_order_id ? getMedusaAdminDraftOrderEditUrl(r.medusa_draft_order_id) : null,
        medusaOrderId: r.medusa_order_id,
        medusaOrderDisplayId: r.medusa_order_display_id,
        medusaOrderPaymentStatus: r.medusa_order_payment_status,
        paymentProvider: r.payment_provider,
        paymentExternalId: r.payment_external_id,
        paymentStatus: r.payment_status,
      }))} />
    </AdminPageShell>
  );
}
