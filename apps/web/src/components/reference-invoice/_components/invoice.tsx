"use client";

import { useEffect, useRef } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";

import { getDefaultInvoiceValues, getInvoiceSubmissionErrors, toInvoiceCreatePayload, type InvoiceFormValues, type InvoiceToDetails } from "./data";
import { InvoiceForm } from "./invoice-form";
import { InvoicePreview } from "./invoice-preview";
import { readResponseJson } from "@/lib/read-response-json";

type InvoiceSubmissionMode = "draft" | "send";

export function Invoice({ clients }: { clients: InvoiceToDetails[] }) {
  const form = useForm<InvoiceFormValues>({
    // Keep the server/client first render deterministic. The live draft values
    // are installed in the effect below once the browser has mounted.
    defaultValues: getDefaultInvoiceValues(new Date("2026-01-01T00:00:00.000Z")),
  });
  const submittingRef = useRef(false);
  const invoice = useWatch({ control: form.control }) as InvoiceFormValues;

  useEffect(() => {
    const defaults = getDefaultInvoiceValues();
    if (clients.length > 0) defaults.to = clients[0];
    form.reset(defaults);
  }, [clients, form]);

  useEffect(() => {
    const persist = async (mode: InvoiceSubmissionMode) => {
      if (submittingRef.current) return;
      const values = form.getValues();
      const validationError = getInvoiceSubmissionErrors(values)[0];
      if (validationError) {
        window.dispatchEvent(new CustomEvent("invoice-status", { detail: { message: validationError.message } }));
        return;
      }
      submittingRef.current = true;
      window.dispatchEvent(new CustomEvent("invoice-status", { detail: { message: mode === "send" ? "Sending invoice..." : "Saving invoice..." } }));
      try {
        const response = await fetch("/api/admin/invoices", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({ invoice: toInvoiceCreatePayload(values), mode }),
        });
        const body = await readResponseJson(response, {} as { data?: { id?: string; reference_number?: string; status?: string }; error?: string });
        if (!response.ok) throw new Error(body.error ?? "Invoice operation failed");
        window.dispatchEvent(new CustomEvent("invoice-status", { detail: { message: `${body.data?.reference_number ?? "Invoice"} ${body.data?.status ?? mode}.` } }));
      } catch (error) {
        window.dispatchEvent(new CustomEvent("invoice-status", { detail: { message: error instanceof Error ? error.message : "Invoice operation failed" } }));
      } finally {
        submittingRef.current = false;
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
      <form className="grid min-w-0 max-w-full gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]" noValidate onSubmit={(event) => event.preventDefault()}>
        <InvoiceForm clients={clients} />
        <InvoicePreview invoice={invoice} />
      </form>
    </FormProvider>
  );
}
