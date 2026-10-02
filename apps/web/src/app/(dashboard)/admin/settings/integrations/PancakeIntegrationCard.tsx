"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";

type Shop = { id: number; name: string; pages: Array<{ id: string; name: string; platform: string | null; autoCreateOrder: boolean | null }> };
type Response = { configured: boolean; data: unknown; message?: string };

const fetcher = async (url: string) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, { credentials: "include", signal: controller.signal });
    const body = await res.json() as Response;
    if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
    return body;
  } catch {
    throw new Error("Pancake connection could not be checked. Try again shortly.");
  } finally {
    window.clearTimeout(timeout);
  }
};

export default function PancakeIntegrationCard() {
  const { data: shopsResponse, error: shopsError, mutate } = useSWR<Response>("/api/admin/integrations/pancake?resource=shops", fetcher, { revalidateOnFocus: false });
  const shops = Array.isArray(shopsResponse?.data) ? shopsResponse.data as Shop[] : [];
  const [shopId, setShopId] = useState("");
  const [resource, setResource] = useState("orders");
  const selectedShop = shopId || (shops[0] ? String(shops[0].id) : "");
  const resourceResponse = useSWR<Response>(
    selectedShop ? `/api/admin/integrations/pancake?resource=${resource}&shopId=${selectedShop}&limit=10` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  return (
    <section className="max-w-4xl rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div>
          <h2 className="text-base font-semibold">Pancake POS</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">Use connected Pancake shops for order sources, customer context, inventory, tags, invoices, and shipping documents.</p>
        </div>
        <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${shopsError ? "bg-red-50 text-red-700" : shopsResponse?.configured ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>
          {shopsError ? "Unavailable" : shopsResponse ? (shopsResponse.configured ? "Connected" : "Not connected") : "Checking"}
        </span>
      </div>
      {!shopsResponse && !shopsError ? (
        <div aria-label="Loading Pancake connection" aria-live="polite" className="mt-4 space-y-3 rounded-md bg-neutral-50 p-3">
          <div className="h-3 w-2/5 animate-pulse rounded bg-neutral-200" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-neutral-200" />
        </div>
      ) : shopsError ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{shopsError.message}</p>
      ) : !shopsResponse?.configured ? (
        <p className="mt-4 rounded-md bg-neutral-50 p-3 text-sm text-neutral-600">{shopsResponse?.message ?? "Pancake POS is not configured."}</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="text-xs font-medium text-neutral-600">Shop<select aria-label="Pancake shop" value={selectedShop} onChange={(event) => setShopId(event.target.value)} className="mt-1 block h-10 w-full rounded border border-neutral-300 px-2 py-2 text-sm"><option value="">Choose a shop</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></label>
            <label className="text-xs font-medium text-neutral-600">View<select aria-label="Pancake resource" value={resource} onChange={(event) => setResource(event.target.value)} className="mt-1 block h-10 w-full rounded border border-neutral-300 px-2 py-2 text-sm">{["orders", "customers", "products", "order_tags", "e_invoices", "warehouses", "inventory_histories", "order_source", "employees"].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
            <Button type="button" variant="outline" size="sm" onClick={() => void mutate()} className="self-end">Refresh shops</Button>
          </div>
          <div aria-live="polite" className="mt-4 rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">
            {resourceResponse.error ? <span className="text-red-600">{resourceResponse.error.message}</span> : resourceResponse.isLoading ? <span className="inline-block h-3 w-48 animate-pulse rounded bg-neutral-200" aria-label="Loading Pancake data" /> : `${Array.isArray(resourceResponse.data?.data) ? resourceResponse.data?.data.length : 0} records available for this view.`}
          </div>
        </>
      )}
    </section>
  );
}
