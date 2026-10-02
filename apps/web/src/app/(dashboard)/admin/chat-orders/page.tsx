import { AdminBreadcrumbs, AdminPageShell } from "@/components/admin-console";
import { ChatIntakeForm } from "@/components/ChatIntakeForm";
import { ChatOrdersWorkspace } from "@/components/ChatOrdersWorkspace";
import { fetchRecentChatIntake } from "@/lib/chat-intake-bridge";
import { requirePagePermission } from "@/lib/require-page-permission";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { CircleCheck, Hourglass, Ticket } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ChatOrdersPage() {
  await requirePagePermission("chat_orders:manage");
  const loadedRows = await fetchRecentChatIntake(80);
  const rows = loadedRows ?? [];

  return (
    <AdminPageShell
      title="Chat orders"
      subtitle={rows.length === 0 ? "Your queue is clear." : `${rows.filter((row) => row.status.toLowerCase().includes("pending")).length} tickets are awaiting operator action.`}
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Chat orders" }]}
        />
      }
    >
      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="Chat order summary">
        {[
          { label: "Total tickets", value: rows.length, description: "All captured conversations", icon: Ticket, tone: "text-primary bg-primary/10" },
          { label: "Pending tickets", value: rows.filter((row) => row.status.toLowerCase().includes("pending")).length, description: "Awaiting operator action", icon: Hourglass, tone: "text-amber-700 bg-amber-100" },
          { label: "Settled tickets", value: rows.filter((row) => row.payment_status === "settled").length, description: "Payment confirmed", icon: CircleCheck, tone: "text-emerald-700 bg-emerald-100" },
        ].map(({ label, value, description, icon: Icon, tone }) => (
          <Card key={label} size="sm" className="border-border/70 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <span className={`grid size-10 place-items-center rounded-xl ${tone}`} aria-hidden="true">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
      <ChatOrdersWorkspace intakeForm={<ChatIntakeForm />} rows={rows.map((r) => ({
        ...r,
        commerceCartId: r.commerce_cart_id,
        commerceOrderId: r.commerce_order_id,
        commerceOrderDisplayId: r.commerce_order_display_id,
        commercePaymentStatus: r.commerce_payment_status,
        paymentProvider: r.payment_provider,
        paymentExternalId: r.payment_external_id,
        paymentStatus: r.payment_status,
      }))} />
      {!loadedRows ? <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">Chat-order data is unavailable from the commerce Worker. No ticket data was loaded.</p> : null}
    </AdminPageShell>
  );
}
