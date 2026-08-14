"use client";

import { useCallback, useEffect, useState } from "react";

import { AdminEmptyState, AdminSection } from "@/components/admin-console";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ReceiptPayload = {
  id: string;
  order_id: string;
  customer_email: string | null;
  receipt_html: string;
  sent_at: string | null;
  created_at: string;
};

type DigitalReceiptLookupProps = {
  /** From server `searchParams` so the page avoids `useSearchParams()` and long SSR stalls. */
  initialOrderId?: string;
};

export function DigitalReceiptLookup({
  initialOrderId: initialFromServer = "",
}: DigitalReceiptLookupProps) {
  const [orderId, setOrderId] = useState(initialFromServer);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);

  const load = useCallback(
    async (id: string) => {
      const trimmed = id.trim();
      if (!trimmed) {
        setError("Enter an order number.");
        setReceipt(null);
        return;
      }
      setLoading(true);
      setError(null);
      setReceipt(null);
      try {
        const res = await fetch(
          `/api/admin/receipts?order_id=${encodeURIComponent(trimmed)}`,
        );
        const body = (await res.json()) as { error?: string; data?: ReceiptPayload };
        if (!res.ok) {
          setError(body.error ?? "Receipt unavailable");
          return;
        }
        if (body.data) {
          setReceipt(body.data);
        }
      } catch {
        setError("Network unavailable");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    setOrderId(initialFromServer);
  }, [initialFromServer]);

  useEffect(() => {
    if (initialFromServer) {
      void load(initialFromServer);
    }
  }, [initialFromServer, load]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <AdminSection title="Receipt lookup" description="Find a stored receipt by its order number.">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void load(orderId);
        }}
      >
        <div className="flex-1">
          <label className="block text-sm font-medium text-foreground">
            Order id
            <Input
            className="mt-2 font-mono"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="Order number"
            autoComplete="off"
            />
          </label>
        </div>
        <Button type="submit" disabled={loading} size="sm">
          {loading ? "Loading…" : "Load receipt"}
        </Button>
      </form>
      </AdminSection>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      {receipt ? (
        <AdminSection title="Receipt result" description={`Order ${receipt.order_id}`}>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap gap-4">
            {receipt.customer_email ? (
              <span>
                <span className="font-semibold text-primary">Email:</span> {receipt.customer_email}
              </span>
            ) : null}
            <span>
              <span className="font-semibold text-primary">Sent:</span>{" "}
              {receipt.sent_at ? new Date(receipt.sent_at).toLocaleString() : "Not sent"}
            </span>
            <span>
              <span className="font-semibold text-primary">Stored:</span>{" "}
              {new Date(receipt.created_at).toLocaleString()}
            </span>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>Print</Button>
              <Button asChild variant="outline" size="sm"><a href={`data:text/html;charset=utf-8,${encodeURIComponent(receipt.receipt_html)}`} download={`receipt-${receipt.order_id}.html`}>Download</a></Button>
            </div>
          </div>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
            <iframe
              title="Receipt preview"
              className="h-[min(70vh,720px)] w-full border-0"
              sandbox="allow-same-origin"
              srcDoc={receipt.receipt_html}
            />
            </CardContent>
          </Card>
        </AdminSection>
      ) : null}
      {!loading && !error && !receipt ? <AdminEmptyState title="No receipt loaded" description="Enter an order number above to view its stored digital receipt." /> : null}
    </div>
  );
}
