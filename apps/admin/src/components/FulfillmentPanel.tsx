"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type CourierOption = { slug: string; label: string };

export type ShipmentRow = {
  id: string;
  tracking_number?: string | null;
  carrier_slug?: string | null;
  status?: string | null;
  label_url?: string | null;
  shipped_at?: string | null;
};

export function FulfillmentPanel({
  orderId,
  initialStatus,
  initialShipments,
}: {
  orderId: string;
  initialStatus: string;
  initialShipments: ShipmentRow[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrierSlug, setCarrierSlug] = useState("jtexpress-ph");
  const [labelUrl, setLabelUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [couriers, setCouriers] = useState<CourierOption[]>([]);

  useEffect(() => {
    fetch("/api/integrations/couriers", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { couriers?: CourierOption[] }) => {
        setCouriers(Array.isArray(d.couriers) ? d.couriers : []);
      })
      .catch(() => {
        setCouriers([]);
      });
  }, []);

  async function addShipment(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading("shipment");
    const res = await fetch("/api/medusa/shipments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `shipment-${crypto.randomUUID()}`,
      },
      body: JSON.stringify({
        orderId,
        trackingNumber: trackingNumber.trim(),
        carrierSlug: carrierSlug.trim() || "jtexpress-ph",
        labelUrl: labelUrl.trim() || undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setLoading(null);
    if (!res.ok) {
      setErr(data.error ?? `Request failed (${res.status})`);
      return;
    }
    setMsg("Shipment saved. Order may move to ready-to-ship when it was paid.");
    setTrackingNumber("");
    setLabelUrl("");
    router.refresh();
  }

  async function patchOrder(next: string) {
    setErr(null);
    setMsg(null);
    setLoading(`status:${next}`);
    const res = await fetch(
      `/api/medusa/orders/${encodeURIComponent(orderId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `order-status-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ status: next }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      status?: string;
    };
    setLoading(null);
    if (!res.ok) {
      setErr(data.error ?? `Request failed (${res.status})`);
      return;
    }
    if (typeof data.status === "string") {
      setStatus(data.status);
    } else {
      setStatus(next);
    }
    setMsg(`Order status updated to ${next.replace(/_/g, " ")}.`);
    router.refresh();
  }

  const canShip =
    status === "paid" || status === "ready_to_ship" || status === "shipped";
  const showMarkShipped = status === "ready_to_ship" || status === "paid";
  const showMarkDelivered = status === "shipped";

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-6">
        <h3 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-4">
          Fulfillment
        </h3>
        <p className="text-sm text-on-surface-variant mb-4">
          Current status:{" "}
          <span className="font-medium text-primary">
            {status.replace(/_/g, " ")}
          </span>
        </p>
        {err && (
          <p className="text-sm text-red-600 mb-3" role="alert">
            {err}
          </p>
        )}
        {msg && (
          <p className="text-sm text-emerald-700 mb-3" role="status">
            {msg}
          </p>
        )}

        {canShip && (
          <form
            onSubmit={(e) => void addShipment(e)}
            className="space-y-4 mb-6"
          >
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Tracking number
              </label>
              <input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                required
                className="w-full rounded border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm"
                placeholder="J&T tracking number"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Carrier
              </label>
              <select
                value={couriers.some((c) => c.slug === carrierSlug) ? carrierSlug : "__custom"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__custom") return;
                  setCarrierSlug(v);
                }}
                className="w-full rounded border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm mb-2"
              >
                <option value="__custom">Custom code below</option>
                {couriers.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                value={carrierSlug}
                onChange={(e) => setCarrierSlug(e.target.value)}
                className="w-full rounded border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-xs font-mono"
                placeholder="Carrier code if not listed above"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Label URL (optional)
              </label>
              <input
                value={labelUrl}
                onChange={(e) => setLabelUrl(e.target.value)}
                className="w-full rounded border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm"
                placeholder="https://…"
              />
            </div>
            <button
              type="submit"
              disabled={loading !== null}
              className="rounded bg-primary px-4 py-2 text-sm font-bold uppercase tracking-widest text-on-primary hover:opacity-90 disabled:opacity-50"
            >
              {loading === "shipment" ? "Saving\u2026" : "Save shipment"}
            </button>
          </form>
        )}

        <div className="flex flex-wrap gap-2">
          {showMarkShipped && (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void patchOrder("shipped")}
              className="rounded border border-primary px-4 py-2 text-sm font-bold uppercase tracking-widest text-primary hover:bg-primary hover:text-on-primary disabled:opacity-50"
            >
              Mark shipped
            </button>
          )}
          {showMarkDelivered && (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void patchOrder("delivered")}
              className="rounded border border-primary px-4 py-2 text-sm font-bold uppercase tracking-widest text-primary hover:bg-primary hover:text-on-primary disabled:opacity-50"
            >
              Mark delivered
            </button>
          )}
          {status === "paid" && (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void patchOrder("ready_to_ship")}
              className="rounded border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface-variant hover:border-primary disabled:opacity-50"
            >
              Mark ready to ship (without tracking yet)
            </button>
          )}
        </div>
      </section>

      <section>
        <h3 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-4">
          Shipments
        </h3>
        {initialShipments.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            No shipments yet. Updates from your shipping partner may appear here automatically.
          </p>
        ) : (
          <ul className="space-y-3">
            {initialShipments.map((s) => (
              <li
                key={s.id}
                className="rounded border border-outline-variant/20 p-4 text-sm"
              >
                <p className="font-medium text-primary">
                  {s.tracking_number ?? "None"}
                </p>
                <p className="text-on-surface-variant">
                  {s.carrier_slug ?? "carrier"} &middot;{" "}
                  {(s.status ?? "").replace(/_/g, " ")}
                </p>
                {s.label_url ? (
                  <a
                    href={s.label_url}
                    className="text-primary text-xs underline mt-1 inline-block"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Label
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
