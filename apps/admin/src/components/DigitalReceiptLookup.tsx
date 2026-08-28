"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { staffHasPermission } from "@universal-music-store/platform-data";

import { AdminEmptyState, AdminSection } from "@/components/admin-console";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { classifyReceiptLookup, type ReceiptLookupState } from "@/lib/admin-receipt-media-state";

type ReceiptOrder = {
  id: string;
  order_number: string;
  email: string | null;
  status: string;
  currency: string;
  grand_total: number;
  created_at: string;
};

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
  orders?: ReceiptOrder[];
  commerceUnavailable?: boolean;
};

export function DigitalReceiptLookup({
  initialOrderId: initialFromServer = "",
  orders = [],
  commerceUnavailable = false,
}: DigitalReceiptLookupProps) {
  const { data: session } = useSession();
  const canSendReceipt = staffHasPermission(session?.user?.permissions ?? [], "receipts:send");
  const [orderId, setOrderId] = useState(initialFromServer);
  const [loading, setLoading] = useState(false);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lookupState, setLookupState] = useState<ReceiptLookupState | null>(null);
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);

  const load = useCallback(
    async (id: string) => {
      const trimmed = id.trim();
      if (!trimmed) {
        setLookupState(classifyReceiptLookup(0, false, false));
        setReceipt(null);
        return;
      }
      setLoading(true);
      setLookupState(null);
      setReceipt(null);
      setActionError(null);
      try {
        const res = await fetch(
          `/api/admin/receipts?order_id=${encodeURIComponent(trimmed)}`,
        );
        const body = (await res.json()) as { error?: string; data?: ReceiptPayload };
        const state = classifyReceiptLookup(res.status, Boolean(body.data));
        setLookupState(state);
        if (state === "found" && body.data) setReceipt(body.data);
      } catch {
        setLookupState("unavailable");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const createReceipt = useCallback(async (id: string) => {
    setCreatingId(id);
    setActionError(null);
    setReceipt(null);
    setLookupState(null);
    try {
      const res = await fetch("/api/admin/receipts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `receipt-${id}-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ order_id: id, send: false }),
      });
      const body = (await res.json()) as { error?: string; data?: ReceiptPayload };
      if (!res.ok || !body.data) {
        throw new Error(body.error ?? "Unable to create receipt");
      }
      setReceipt(body.data);
      setLookupState("found");
      setOrderId(id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to create receipt");
    } finally {
      setCreatingId(null);
    }
  }, []);

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
      <AdminSection title="Orders" description="Select an order to view or create its digital receipt.">
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {commerceUnavailable ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Commerce is unavailable. Orders and receipt actions will return when it is back.</td></tr>
              ) : orders.length ? orders.map((order) => (
                <tr key={order.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{order.order_number}</td>
                  <td className="px-4 py-3 text-muted-foreground">{order.email ?? "Guest"}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{order.status.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">{order.currency} {order.grand_total.toLocaleString("en-PH")}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => void load(order.id)} disabled={creatingId === order.id}>Load</Button>
                      {canSendReceipt ? (
                        <Button type="button" size="sm" onClick={() => void createReceipt(order.id)} disabled={creatingId !== null}>
                          {creatingId === order.id ? "Creating…" : "Create receipt"}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No orders found in commerce.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminSection>
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
            Order number or id
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

      {actionError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {actionError}
        </div>
      ) : null}

      {lookupState === "not_found" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
          No stored receipt was found for this order.
        </div>
      ) : null}

      {lookupState === "empty" || lookupState === "unavailable" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {lookupState === "empty" ? "Enter an order number." : "Receipt service is unavailable. Try again later."}
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
      {!loading && !lookupState && !receipt ? <AdminEmptyState title="No receipt loaded" description="Enter an order number above to view its stored digital receipt." /> : null}
    </div>
  );
}
