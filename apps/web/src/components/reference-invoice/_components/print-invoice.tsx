"use client";

import * as React from "react";

import { createPortal } from "react-dom";

import type { InvoiceFormValues } from "./data";
import { InvoicePaper } from "./invoice-paper";
import { useHydrated } from "@/lib/use-hydrated";

export function PrintInvoice({ invoice }: { invoice: InvoiceFormValues }) {
  const mounted = useHydrated();

  if (!mounted) return null;

  return createPortal(
    <div className="hidden print:block" data-print-root>
      <InvoicePaper invoice={invoice} />
    </div>,
    document.body,
  );
}
