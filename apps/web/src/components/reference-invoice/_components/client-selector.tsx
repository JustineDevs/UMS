import { Plus } from "lucide-react";
import Link from "next/link";
import { Controller, useFormContext } from "react-hook-form";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getInitials } from "@/lib/utils";

import type { InvoiceFormValues, InvoiceToDetails } from "./data";

export function ClientSelector({ clients }: { clients: InvoiceToDetails[] }) {
  const { control } = useFormContext<InvoiceFormValues>();

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium tracking-tight">Billed To</h2>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/users">
          <Plus data-icon="inline-start" />
          Add New Client
          </Link>
        </Button>
      </div>

      <Controller
        control={control}
        name="to"
        render={({ field }) => {
          const selectedClient = field.value;

          return (
            <Field className="gap-2">
              <div className="flex items-center justify-between gap-3">
                <FieldLabel className="text-xs">Client profile</FieldLabel>
                <Select
                  value={selectedClient.id}
                  onValueChange={(clientId) => {
                    const nextClient = clients.find((item) => item.id === clientId);

                    if (nextClient) field.onChange(nextClient);
                  }}
                >
                  <SelectTrigger className="h-8 w-auto gap-2 border-0 px-2 text-xs shadow-none">
                    <SelectValue>Change client</SelectValue>
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {clients.map((clientOption) => (
                        <SelectItem key={clientOption.id} value={clientOption.id}>
                          {clientOption.name} · {clientOption.email}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="after:rounded-md">
                    <AvatarFallback className="rounded-md bg-card text-foreground">
                      {getInitials(selectedClient.name).slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">{selectedClient.name || "No client selected"}</p>
                    <p className="text-muted-foreground">{selectedClient.email || "Select a client to hydrate billing details"}</p>
                    {selectedClient.addressLines.length > 0 ? (
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{selectedClient.addressLines.join(" · ")}</p>
                    ) : null}
                  </div>
                </div>
              </div>
              {!clients.length ? (
                <p className="text-xs text-muted-foreground">
                  Create a customer in the commerce system before sending an invoice.
                </p>
              ) : null}
            </Field>
          );
        }}
      />
    </section>
  );
}
