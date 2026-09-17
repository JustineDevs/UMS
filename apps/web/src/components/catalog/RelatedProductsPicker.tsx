"use client";

import { parseRelatedHandlesInput } from "@/lib/catalog-product-metadata";
import { useCallback, useEffect, useState } from "react";

type Suggestion = { id: string; title: string; handle: string };

type Props = {
  valueText: string;
  onChangeText: (_next: string) => void;
  /** Omit from pick list (current product handle when editing). */
  excludeHandle?: string;
};

export function RelatedProductsPicker({
  valueText,
  onChangeText,
  excludeHandle,
}: Props) {
  const selected = parseRelatedHandlesInput(valueText);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchSuggestions = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/catalog/products/suggestions?q=${encodeURIComponent(query)}`,
      );
      const j = (await res.json()) as {
        items?: Suggestion[];
        error?: string;
      };
      if (!res.ok || !Array.isArray(j.items)) {
        setItems([]);
        return;
      }
      const ex = excludeHandle?.trim().toLowerCase();
      setItems(
        j.items.filter(
          (row) =>
            row.handle &&
            (!ex || row.handle.toLowerCase() !== ex),
        ),
      );
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [excludeHandle]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      void fetchSuggestions(q);
    }, 220);
    return () => window.clearTimeout(t);
  }, [open, q, fetchSuggestions]);

  function addHandle(h: string) {
    const t = h.trim();
    if (!t) return;
    const next = parseRelatedHandlesInput(valueText);
    if (next.includes(t)) return;
    onChangeText([...next, t].join(", "));
    setQ("");
  }

  function removeHandle(h: string) {
    const next = selected.filter((x) => x !== h);
    onChangeText(next.join(", "));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selected.map((h) => (
          <span
            key={h}
            className="inline-flex items-center gap-1 rounded-full border border-outline-variant/30 bg-surface-container-low px-2 py-1 font-mono text-xs"
          >
            {h}
            <button
              type="button"
              className="rounded px-1 text-on-surface-variant hover:bg-black/5"
              aria-label={`Remove ${h}`}
              onClick={() => removeHandle(h)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          type="search"
          className="mt-1 w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
          placeholder="Search products by title or handle…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 160)}
          maxLength={200}
          aria-label="Search catalog for related product"
        />
        {open ? (
          <ul
            className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-outline-variant/30 bg-white py-1 text-sm shadow-md"
            role="listbox"
          >
            {loading ? (
              <li className="px-3 py-2 text-on-surface-variant">Loading…</li>
            ) : items.length === 0 ? (
              <li className="px-3 py-2 text-on-surface-variant">No matches</li>
            ) : (
              items.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-surface-container-low"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addHandle(row.handle)}
                  >
                    <span className="font-medium">{row.title}</span>
                    <span className="ml-2 font-mono text-xs text-on-surface-variant">
                      {row.handle}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      <textarea
        className="mt-1 w-full min-h-[64px] rounded-lg border border-outline-variant/30 px-3 py-2 font-mono text-xs"
        value={valueText}
        onChange={(e) => onChangeText(e.target.value)}
        placeholder="Handles also editable: comma or newline separated"
        maxLength={2000}
        aria-label="Related product handles"
      />
    </div>
  );
}
