import { Separator } from "@/components/ui/separator";

import { ClientSelector } from "./client-selector";
import { InvoiceAdjustments } from "./invoice-adjustments";
import { InvoiceDetails } from "./invoice-details";
import { InvoiceItems } from "./invoice-items";
import type { InvoiceToDetails } from "./data";

export function InvoiceForm({ clients }: { clients: InvoiceToDetails[] }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <InvoiceDetails />

      <Separator />

      <ClientSelector clients={clients} />

      <Separator />

      <InvoiceItems />

      <Separator />

      <InvoiceAdjustments />
    </div>
  );
}
