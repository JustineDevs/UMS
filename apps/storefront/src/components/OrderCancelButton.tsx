"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";

type Props = {
  orderId: string;
  orderDisplayId: string | number;
};

export function OrderCancelButton({ orderId, orderDisplayId }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/orders/${orderId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? "Could not cancel order. Contact support.");
        setLoading(false);
        setConfirming(false);
        return;
      }
      posthog.capture("order_cancellation_requested", {
        order_id: orderId,
      });
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <p className="text-xs text-on-surface-variant text-right">Cancel order #{orderDisplayId}?</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="rounded border border-outline-variant px-3 py-1 text-xs font-medium text-on-surface-variant hover:bg-surface-container disabled:opacity-40"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="rounded bg-error px-3 py-1 text-xs font-bold text-on-error hover:opacity-90 disabled:opacity-40"
          >
            {loading ? "Cancelling..." : "Cancel order"}
          </button>
        </div>
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-xs text-error hover:underline"
    >
      Cancel
    </button>
  );
}
