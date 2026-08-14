"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type VariantLine = {
  variantId: string;
  label: string;
  productTitle: string;
  sku: string | null;
};

type CartLine = {
  variantId: string;
  label: string;
  quantity: number;
};

export function ChatIntakeForm() {
  const router = useRouter();
  const [source, setSource] = useState("manual");
  const [rawText, setRawText] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [searchQ, setSearchQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHits, setSearchHits] = useState<VariantLine[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (!searchOpen || searchQ.trim().length < 2) {
      setSearchHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      setSearchLoading(true);
      fetch(
        `/api/admin/chat-orders/variant-suggestions?q=${encodeURIComponent(searchQ.trim())}`,
      )
        .then((r) => r.json())
        .then((body: { lines?: VariantLine[] }) => {
          setSearchHits(Array.isArray(body.lines) ? body.lines : []);
        })
        .catch(() => setSearchHits([]))
        .finally(() => setSearchLoading(false));
    }, 220);
    return () => window.clearTimeout(t);
  }, [searchOpen, searchQ]);

  const addVariant = useCallback((hit: VariantLine) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === hit.variantId);
      if (existing) {
        return prev.map((l) =>
          l.variantId === hit.variantId
            ? { ...l, quantity: l.quantity + 1 }
            : l,
        );
      }
      return [
        ...prev,
        { variantId: hit.variantId, label: hit.label, quantity: 1 },
      ];
    });
    setSearchQ("");
    setSearchHits([]);
    setSearchOpen(false);
  }, []);

  const removeLine = useCallback((variantId: string) => {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  }, []);

  const setQty = useCallback((variantId: string, quantity: number) => {
    const q = Math.max(1, Math.floor(quantity) || 1);
    setLines((prev) =>
      prev.map((l) => (l.variantId === variantId ? { ...l, quantity: q } : l)),
    );
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);

    const items = lines.map((l) => ({
      variantId: l.variantId,
      quantity: l.quantity,
    }));

    const res = await fetch("/api/integrations/chat-orders/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `chat-${crypto.randomUUID()}`,
      },
      body: JSON.stringify({
        source,
        raw_text: rawText.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        items,
      }),
    });
    setLoading(false);
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      intakeId?: string;
      draftOrderId?: string | null;
    };
    if (!res.ok) {
      setErr(data.error ?? `Failed (${res.status})`);
      return;
    }
    const parts: string[] = ["Saved to the queue."];
    if (data.draftOrderId) {
      parts.push("A draft order was started in your store admin.");
    } else if (items.length > 0) {
      parts.push(
        "No draft order was created (check store connection or line items).",
      );
    }
    setMsg(parts.join(" "));
    setRawText("");
    setAddress("");
    setLines([]);
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="rounded border border-outline-variant/20 bg-surface-container-lowest p-6 space-y-4"
    >
      <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
        New intake
      </h3>
      {err ? (
        <p className="text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="text-sm text-emerald-700" role="status">
          {msg}
        </p>
      ) : null}
      <div>
        <label className="block text-xs font-bold uppercase text-on-surface-variant mb-1">
          Source
        </label>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
          placeholder="e.g. Messenger, Viber, phone"
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase text-on-surface-variant mb-1">
          Customer message (notes)
        </label>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          className="w-full rounded border border-outline-variant/30 px-3 py-2 text-sm min-h-[96px]"
          placeholder="What they asked for, delivery notes, etc."
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase text-on-surface-variant mb-1">
          Phone
        </label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
          placeholder="Contact number"
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase text-on-surface-variant mb-1">
          Address (optional)
        </label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded border border-outline-variant/30 px-3 py-2 text-sm min-h-[72px]"
          placeholder="Shipping or pickup details"
        />
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-bold uppercase text-on-surface-variant">
          Products from catalog
        </label>
        <p className="text-xs text-on-surface-variant">
          Search by product name. Picking a row adds a sellable option so a draft order can be created
          in your store.
        </p>
        <div className="relative">
          <input
            type="search"
            className="w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
            placeholder="Type at least 2 characters…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
          />
          {searchOpen && searchQ.trim().length >= 2 ? (
            <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded border border-outline-variant/30 bg-white py-1 text-sm shadow-md">
              {searchLoading ? (
                <li className="px-3 py-2 text-on-surface-variant">Loading…</li>
              ) : searchHits.length === 0 ? (
                <li className="px-3 py-2 text-on-surface-variant">No matches</li>
              ) : (
                searchHits.map((h) => (
                  <li key={h.variantId}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-surface-container-low"
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => addVariant(h)}
                    >
                      <span className="font-medium">{h.label}</span>
                      {h.sku ? (
                        <span className="ml-2 font-mono text-xs text-on-surface-variant">
                          {h.sku}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>

        {lines.length === 0 ? (
          <p className="text-xs text-on-surface-variant">
            Add at least one catalog line before submitting this intake.
          </p>
        ) : (
          <ul className="space-y-2">
            {lines.map((l) => (
              <li
                key={l.variantId}
                className="flex flex-wrap items-center gap-2 rounded border border-outline-variant/20 p-3 text-sm"
              >
                <span className="min-w-0 flex-1 font-medium">{l.label}</span>
                <input
                  type="number"
                  min={1}
                  className="w-16 rounded border border-outline-variant/30 px-2 py-1 text-sm"
                  value={l.quantity}
                  onChange={(e) =>
                    setQty(l.variantId, parseInt(e.target.value, 10) || 1)
                  }
                  aria-label="Quantity"
                />
                <button
                  type="button"
                  className="text-xs font-semibold text-on-surface-variant hover:text-error"
                  onClick={() => removeLine(l.variantId)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || lines.length === 0}
        className="rounded bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-primary disabled:opacity-50"
      >
        {loading ? "Saving…" : "Submit intake"}
      </button>
    </form>
  );
}
