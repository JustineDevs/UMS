"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type ReturnLine = {
  id: string;
  title: string;
  quantity: number;
  returnedQuantity: number;
};

export function OrderReturnForm({
  orderId,
  lines,
}: {
  orderId: string;
  lines: ReturnLine[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const l of lines) {
      const max = Math.max(0, l.quantity - l.returnedQuantity);
      init[l.id] = max > 0 ? 0 : 0;
    }
    return init;
  });
  const [note, setNote] = useState("");

  const returnable = lines.filter((l) => l.quantity - l.returnedQuantity > 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const items = returnable
      .map((l) => {
        const q = quantities[l.id] ?? 0;
        const max = l.quantity - l.returnedQuantity;
        return { item_id: l.id, quantity: q, max };
      })
      .filter((x) => x.quantity > 0 && x.quantity <= x.max)
      .map(({ item_id, quantity }) => ({ item_id, quantity }));

    if (items.length === 0) {
      setError("Enter a quantity for at least one line.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/orders/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          items,
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      router.push(`/account?return=submitted`);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  if (returnable.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant">
        Nothing left to return for this order.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <ul className="space-y-4">
        {returnable.map((l) => {
          const max = l.quantity - l.returnedQuantity;
          return (
            <li
              key={l.id}
              className="flex flex-col gap-2 border-b border-outline-variant/20 pb-4 last:border-0"
            >
              <p className="text-sm font-medium text-on-surface">{l.title}</p>
              <p className="text-xs text-on-surface-variant">
                Purchased {l.quantity}. Already returned {l.returnedQuantity}. You
                can return up to {max}.
              </p>
              <label className="text-xs font-medium text-on-surface-variant">
                Quantity to return
                <input
                  type="number"
                  min={0}
                  max={max}
                  value={quantities[l.id] ?? 0}
                  onChange={(e) => {
                    const v = Math.max(
                      0,
                      Math.min(max, Math.floor(Number(e.target.value) || 0)),
                    );
                    setQuantities((prev) => ({ ...prev, [l.id]: v }));
                  }}
                  className="mt-1 block w-24 bg-surface-container-low border border-outline-variant/30 rounded px-3 py-2 text-sm"
                />
              </label>
            </li>
          );
        })}
      </ul>
      <label className="block text-sm text-on-surface-variant">
        Note (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="mt-1 w-full bg-surface-container-low border border-outline-variant/30 rounded px-3 py-2 text-sm"
        />
      </label>
      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-on-primary px-6 py-3 rounded font-medium hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit return request"}
      </button>
    </form>
  );
}
