import { requirePagePermission } from "@/lib/require-page-permission";
import { AdminPageHeader, AuditTimeline } from "@/components/admin-console";

import { Invoice } from "@/components/reference-invoice/_components/invoice";
import { fetchMedusaCustomersForAdmin } from "@/lib/customers-bridge";
import { InvoiceActions } from "./invoice-actions";

export const dynamic = "force-dynamic";

export default async function InvoicePage() {
  await requirePagePermission("receipts:send");
  const customers = await fetchMedusaCustomersForAdmin();
  const invoiceClients = customers
    .filter((customer) => customer.id && customer.email)
    .map((customer) => ({
      id: customer.id,
      name: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.email!,
      email: customer.email!,
      addressLines: [],
      taxId: "",
    }));

  return (
    <div className="flex min-w-0 flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <AdminPageHeader
        title="Create New Invoice"
        subtitle="Add invoice details, review the preview, and send it to your client."
        actions={<InvoiceActions />}
      />

      <Invoice clients={invoiceClients} />
      <AuditTimeline title="Recent invoice activity" />
    </div>
  );
}
