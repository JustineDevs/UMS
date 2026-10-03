"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer } from "react";

type CourierOption = { slug: string; label: string };
type FulfillmentState = {
  status: string;
  trackingNumber: string;
  carrierSlug: string;
  labelUrl: string;
  msg: string | null;
  err: string | null;
  loading: string | null;
  couriers: CourierOption[];
};
type FulfillmentAction =
  | { type: "status"; value: string }
  | { type: "field"; field: "trackingNumber" | "carrierSlug" | "labelUrl"; value: string }
  | { type: "couriers"; value: CourierOption[] }
  | { type: "loading"; value: string | null }
  | { type: "message"; value: string | null }
  | { type: "error"; value: string | null }
  | { type: "clear-form" };

function fulfillmentReducer(state: FulfillmentState, action: FulfillmentAction): FulfillmentState {
  if (action.type === "status") return { ...state, status: action.value };
  if (action.type === "field") return { ...state, [action.field]: action.value };
  if (action.type === "couriers") return { ...state, couriers: action.value };
  if (action.type === "loading") return { ...state, loading: action.value };
  if (action.type === "message") return { ...state, msg: action.value };
  if (action.type === "error") return { ...state, err: action.value };
  return { ...state, trackingNumber: "", labelUrl: "" };
}

function initialFulfillmentState(status: string): FulfillmentState {
  return { status, trackingNumber: "", carrierSlug: "jtexpress-ph", labelUrl: "", msg: null, err: null, loading: null, couriers: [] };
}

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
  const [state, dispatch] = useReducer(fulfillmentReducer, initialStatus, initialFulfillmentState);
  const { status, trackingNumber, carrierSlug, labelUrl, msg, err, loading, couriers } = state;

  useEffect(() => {
    dispatch({ type: "status", value: initialStatus });
  }, [initialStatus]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/integrations/couriers", { credentials: "include", signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { couriers: [] }))
      .then((d: { couriers?: CourierOption[] }) => {
        dispatch({ type: "couriers", value: Array.isArray(d.couriers) ? d.couriers : [] });
      })
      .catch(() => {
        if (!controller.signal.aborted) dispatch({ type: "couriers", value: [] });
      });
    return () => controller.abort();
  }, []);

  async function addShipment(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "error", value: null });
    dispatch({ type: "message", value: null });
    dispatch({ type: "loading", value: "shipment" });
    const res = await fetch("/api/admin/delivery-logistics/shipments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `shipment-${crypto.randomUUID()}`,
      },
      body: JSON.stringify({
        kind: "shipment",
        order_id: orderId,
        tracking_status: "assigned",
        tracking_url: trackingNumber.trim()
          ? `https://www.jtexpress.ph/index/query/gcsSearch.html?bills=${encodeURIComponent(trackingNumber.trim())}`
          : null,
        courier_slug: carrierSlug.trim() || "jtexpress-ph",
        courier_label: (couriers.find((courier) => courier.slug === carrierSlug)?.label ?? carrierSlug.trim()) || "J&T Express",
        status: "assigned",
        metadata: {
          tracking_number: trackingNumber.trim(),
          label_url: labelUrl.trim() || null,
        },
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      dispatch({ type: "loading", value: null });
      dispatch({ type: "error", value: data.error ?? `Request failed (${res.status})` });
      return;
    }
    await res.json().catch(() => ({}));
    dispatch({ type: "loading", value: null });
    dispatch({ type: "message", value: "Shipment saved. Order may move to ready-to-ship when it was paid." });
    dispatch({ type: "clear-form" });
    router.refresh();
  }

  async function patchOrder(next: string) {
    dispatch({ type: "error", value: null });
    dispatch({ type: "message", value: null });
    dispatch({ type: "loading", value: `status:${next}` });
    const res = await fetch(
      `/api/admin/orders/${encodeURIComponent(orderId)}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `order-status-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ status: next }),
      },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        status?: string;
      };
      dispatch({ type: "loading", value: null });
      dispatch({ type: "error", value: data.error ?? `Request failed (${res.status})` });
      return;
    }
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      status?: string;
    };
    dispatch({ type: "loading", value: null });
    if (typeof data.status === "string") {
      dispatch({ type: "status", value: data.status });
    } else {
      dispatch({ type: "status", value: next });
    }
    dispatch({ type: "message", value: `Order status updated to ${next.replace(/_/g, " ")}.` });
    router.refresh();
  }

  const canShip = status === "packed" || status === "shipped";
  const showMarkShipped = status === "packed";
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
              <label htmlFor="fulfillment-tracking-number" className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Tracking number
              </label>
              <input
                id="fulfillment-tracking-number"
                value={trackingNumber}
                onChange={(e) => dispatch({ type: "field", field: "trackingNumber", value: e.target.value })}
                required
                className="w-full rounded border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm"
                placeholder="J&T tracking number"
              />
            </div>
            <div>
              <label htmlFor="fulfillment-carrier" className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Carrier
              </label>
              <select
                id="fulfillment-carrier"
                value={couriers.some((c) => c.slug === carrierSlug) ? carrierSlug : "__custom"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__custom") return;
                  dispatch({ type: "field", field: "carrierSlug", value: v });
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
                aria-label="Custom carrier code"
                value={carrierSlug}
                onChange={(e) => dispatch({ type: "field", field: "carrierSlug", value: e.target.value })}
                className="w-full rounded border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-xs font-mono"
                placeholder="Carrier code if not listed above"
              />
            </div>
            <div>
              <label htmlFor="fulfillment-label-url" className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Label URL (optional)
              </label>
              <input
                id="fulfillment-label-url"
                value={labelUrl}
                onChange={(e) => dispatch({ type: "field", field: "labelUrl", value: e.target.value })}
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
          {status === "paid" && (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void patchOrder("processing")}
              className="rounded border border-primary px-4 py-2 text-sm font-bold uppercase tracking-widest text-primary hover:bg-primary hover:text-on-primary disabled:opacity-50"
            >
              Start processing
            </button>
          )}
          {status === "processing" && (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void patchOrder("packed")}
              className="rounded border border-primary px-4 py-2 text-sm font-bold uppercase tracking-widest text-primary hover:bg-primary hover:text-on-primary disabled:opacity-50"
            >
              Mark packed
            </button>
          )}
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
