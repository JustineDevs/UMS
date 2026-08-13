"use client";

import { useState } from "react";
import useSWR from "swr";

type Shop = { id: number; name: string; pages: Array<{ id: string; name: string; platform: string | null; autoCreateOrder: boolean | null }> };
type Response = { configured: boolean; data: unknown; message?: string };

const fetcher = (url: string) => fetch(url, { credentials: "include" }).then(async (res) => {
  const body = await res.json() as Response;
  if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
  return body;
});

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
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Pancake POS</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">Use connected Pancake shops for order sources, customer context, inventory, tags, invoices, and shipping documents.</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${shopsResponse?.configured ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>
          {shopsResponse?.configured ? "Connected" : "Not connected"}
        </span>
      </div>
      {!shopsResponse?.configured ? (
        <p className="mt-4 rounded-md bg-neutral-50 p-3 text-sm text-neutral-600">{shopsError?.message ?? shopsResponse?.message ?? "Checking Pancake connection…"}</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="text-xs font-medium text-neutral-600">Shop<select value={selectedShop} onChange={(event) => setShopId(event.target.value)} className="mt-1 block w-full rounded border border-neutral-300 px-2 py-2 text-sm"><option value="">Choose a shop</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></label>
            <label className="text-xs font-medium text-neutral-600">View<select value={resource} onChange={(event) => setResource(event.target.value)} className="mt-1 block w-full rounded border border-neutral-300 px-2 py-2 text-sm">{["orders", "customers", "products", "order_tags", "e_invoices", "warehouses", "inventory_histories", "order_source", "employees"].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
            <button type="button" onClick={() => void mutate()} className="self-end rounded border border-neutral-300 px-3 py-2 text-xs font-semibold hover:bg-neutral-50">Refresh shops</button>
          </div>
          <div className="mt-4 rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">
            {resourceResponse.error ? <span className="text-red-600">{resourceResponse.error.message}</span> : resourceResponse.isLoading ? "Loading Pancake data…" : `${Array.isArray(resourceResponse.data?.data) ? resourceResponse.data?.data.length : 0} records available for this view.`}
          </div>
        </>
      )}
    </section>
  );
}
