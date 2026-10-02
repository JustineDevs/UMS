import { requirePagePermission } from "@/lib/require-page-permission";
import { AdminPageHeader } from "@/components/admin-console";

import { Invoice } from "@/components/reference-invoice/_components/invoice";
import { fetchCustomersForAdmin } from "@/lib/customer-admin-bridge";
import { InvoiceActions } from "./invoice-actions";

export const dynamic = "force-dynamic";

export default async function InvoicePage() {
  await requirePagePermission("receipts:send");
  const customers = await fetchCustomersForAdmin();
  const invoiceClients = customers.flatMap((customer) => {
    if (!customer.id || !customer.email) return [];
    return [{
      id: customer.id,
      name: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.email,
      email: customer.email,
      addressLines: [],
      taxId: "",
    }];
  });

  return (
    <div className="admin-content-width flex min-w-0 flex-col gap-6 px-[var(--admin-page-px)] py-[var(--admin-page-py)]">
      <AdminPageHeader
        title="Create New Invoice"
        subtitle="Add invoice details, review the preview, and send it to your client."
        actions={<InvoiceActions />}
      />

      <Invoice clients={invoiceClients} />
    </div>
  );
}
