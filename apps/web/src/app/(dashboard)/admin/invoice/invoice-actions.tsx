"use client";

import { useEffect, useState } from "react";
import { Download, Save } from "lucide-react";

import { Button } from "@/components/ui/button";

function dispatch(name: "invoice-save-draft" | "invoice-send") {
  window.dispatchEvent(new CustomEvent(name));
}

export function InvoiceActions() {
  const [status, setStatus] = useState<string | null>(null);
  const [provider, setProvider] = useState<"none" | "stripe" | "paypal">("none");
  useEffect(() => {
    const onStatus = (event: Event) => setStatus((event as CustomEvent<{ message?: string }>).detail?.message ?? null);
    window.addEventListener("invoice-status", onStatus);
    return () => window.removeEventListener("invoice-status", onStatus);
  }, []);
  return (
    <div className="flex items-center gap-2">
      <select aria-label="Invoice provider" value={provider} onChange={(event) => { const value = event.target.value as typeof provider; setProvider(value); window.dispatchEvent(new CustomEvent("invoice-provider", { detail: value })); }} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
        <option value="none">Local only</option>
        <option value="stripe">Stripe</option>
        <option value="paypal">PayPal</option>
      </select>
      <Button type="button" variant="outline" size="sm" onClick={() => dispatch("invoice-save-draft")}>
        <Save data-icon="inline-start" /> Save as Draft
      </Button>
      <Button type="button" size="sm" onClick={() => dispatch("invoice-send")}>
        <Download data-icon="inline-start" /> Send Invoice
      </Button>
      {status ? <span role="status" className="text-xs text-muted-foreground">{status}</span> : null}
    </div>
  );
}
