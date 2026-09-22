"use client";

import { useEffect } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";

import { getDefaultInvoiceValues, type InvoiceFormValues, type InvoiceToDetails } from "./data";
import { InvoiceForm } from "./invoice-form";
import { InvoicePreview } from "./invoice-preview";
import { readResponseJson } from "@/lib/read-response-json";

export function Invoice({ clients }: { clients: InvoiceToDetails[] }) {
  const form = useForm<InvoiceFormValues>({
    defaultValues: getDefaultInvoiceValues(),
  });
  const invoice = useWatch({ control: form.control }) as InvoiceFormValues;

  useEffect(() => {
    if (form.getValues("to.id") || clients.length === 0) return;
    form.setValue("to", clients[0], { shouldDirty: false });
  }, [clients, form]);

  useEffect(() => {
    const persist = async (mode: "draft" | "send") => {
      window.dispatchEvent(new CustomEvent("invoice-status", { detail: { message: mode === "send" ? "Sending invoice..." : "Saving invoice..." } }));
      try {
        const response = await fetch("/api/admin/invoices", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({ invoice: form.getValues(), mode }),
        });
        const body = await readResponseJson(response, {} as { data?: { id?: string; reference_number?: string; status?: string }; error?: string });
        if (!response.ok) throw new Error(body.error ?? "Invoice operation failed");
        window.dispatchEvent(new CustomEvent("invoice-status", { detail: { message: `${body.data?.reference_number ?? "Invoice"} ${body.data?.status ?? mode}.` } }));
      } catch (error) {
        window.dispatchEvent(new CustomEvent("invoice-status", { detail: { message: error instanceof Error ? error.message : "Invoice operation failed" } }));
      }
    };
    const saveDraft = () => void persist("draft");
    const sendInvoice = () => void persist("send");
    window.addEventListener("invoice-save-draft", saveDraft);
    window.addEventListener("invoice-send", sendInvoice);
    return () => {
      window.removeEventListener("invoice-save-draft", saveDraft);
      window.removeEventListener("invoice-send", sendInvoice);
    };
  }, [form]);

  return (
    <FormProvider {...form}>
      <form className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]" noValidate onSubmit={(event) => event.preventDefault()}>
        <InvoiceForm clients={clients} />
        <InvoicePreview invoice={invoice} />
      </form>
    </FormProvider>
  );
}
