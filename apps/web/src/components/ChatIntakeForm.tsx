"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer } from "react";

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

type FormState = {
  source: string;
  rawText: string;
  phone: string;
  address: string;
  lines: CartLine[];
  msg: string | null;
  err: string | null;
  loading: boolean;
  searchQ: string;
  searchOpen: boolean;
  searchHits: VariantLine[];
  searchLoading: boolean;
};

type FormAction =
  | { type: "field"; field: "source" | "rawText" | "phone" | "address"; value: string }
  | { type: "lines"; update: (_lines: CartLine[]) => CartLine[] }
  | { type: "search"; field: "searchQ" | "searchOpen"; value: string | boolean }
  | { type: "searchHits"; value: VariantLine[] }
  | { type: "searchLoading"; value: boolean }
  | { type: "message"; value: string | null }
  | { type: "error"; value: string | null }
  | { type: "loading"; value: boolean }
  | { type: "resetAfterSubmit" };

const initialFormState: FormState = {
  source: "manual",
  rawText: "",
  phone: "",
  address: "",
  lines: [],
  msg: null,
  err: null,
  loading: false,
  searchQ: "",
  searchOpen: false,
  searchHits: [],
  searchLoading: false,
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "field":
      return { ...state, [action.field]: action.value };
    case "lines":
      return { ...state, lines: action.update(state.lines) };
    case "search":
      return { ...state, [action.field]: action.value } as FormState;
    case "searchHits":
      return { ...state, searchHits: action.value };
    case "searchLoading":
      return { ...state, searchLoading: action.value };
    case "message":
      return { ...state, msg: action.value };
    case "error":
      return { ...state, err: action.value };
    case "loading":
      return { ...state, loading: action.value };
    case "resetAfterSubmit":
      return { ...state, rawText: "", address: "", lines: [] };
    default:
      return state;
  }
}

export function ChatIntakeForm() {
  const router = useRouter();
  const [state, dispatch] = useReducer(formReducer, initialFormState);
  const { source, rawText, phone, address, lines, msg, err, loading, searchQ, searchOpen, searchHits, searchLoading } = state;

  useEffect(() => {
    if (!searchOpen || searchQ.trim().length < 2) {
      dispatch({ type: "searchHits", value: [] });
      return;
    }
    const controller = new AbortController();
    const t = window.setTimeout(() => {
      dispatch({ type: "searchLoading", value: true });
      fetch(
        `/api/admin/chat-orders/variant-suggestions?q=${encodeURIComponent(searchQ.trim())}`,
        { signal: controller.signal },
      )
        .then((r) => {
          if (!r.ok) throw new Error(`Suggestion lookup failed (${r.status})`);
          return r.json();
        })
        .then((body: { lines?: VariantLine[] }) => {
          dispatch({ type: "searchHits", value: Array.isArray(body.lines) ? body.lines : [] });
        })
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            dispatch({ type: "searchHits", value: [] });
          }
        })
        .finally(() => dispatch({ type: "searchLoading", value: false }));
    }, 220);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [searchOpen, searchQ]);

  const addVariant = useCallback((hit: VariantLine) => {
    dispatch({ type: "lines", update: (prev) => {
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
    } });
    dispatch({ type: "search", field: "searchQ", value: "" });
    dispatch({ type: "searchHits", value: [] });
    dispatch({ type: "search", field: "searchOpen", value: false });
  }, []);

  const removeLine = useCallback((variantId: string) => {
    dispatch({ type: "lines", update: (prev) => prev.filter((l) => l.variantId !== variantId) });
  }, []);

  const setQty = useCallback((variantId: string, quantity: number) => {
    const q = Math.max(1, Math.floor(quantity) || 1);
    dispatch({ type: "lines", update: (prev) =>
      prev.map((l) => (l.variantId === variantId ? { ...l, quantity: q } : l)),
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    dispatch({ type: "error", value: null });
    dispatch({ type: "message", value: null });
    dispatch({ type: "loading", value: true });

    const items = lines.map((l) => ({
      variantId: l.variantId,
      quantity: l.quantity,
    }));

    try {
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
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        dispatch({ type: "error", value: data.error ?? `Failed (${res.status})` });
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        draftOrderId?: string | null;
      };
      const parts: string[] = ["Saved to the queue."];
      if (data.draftOrderId) {
        parts.push("A draft order was started in your store admin.");
      } else if (items.length > 0) {
        parts.push(
          "No draft order was created (check store connection or line items).",
        );
      }
      dispatch({ type: "message", value: parts.join(" ") });
      dispatch({ type: "resetAfterSubmit" });
      router.refresh();
    } catch {
      dispatch({ type: "error", value: "Unable to save the intake right now. Try again." });
    } finally {
      dispatch({ type: "loading", value: false });
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="space-y-5"
    >
      <h3 className="text-sm font-semibold text-foreground">Order details</h3>
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
        <label htmlFor="chat-intake-source" className="block text-xs font-bold uppercase text-on-surface-variant mb-1">
          Source
        </label>
        <input
          id="chat-intake-source"
          value={source}
          onChange={(e) => dispatch({ type: "field", field: "source", value: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-xs outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring/40"
          placeholder="e.g. Messenger, Viber, phone"
        />
      </div>
      <div>
        <label htmlFor="chat-intake-message" className="block text-xs font-bold uppercase text-on-surface-variant mb-1">
          Customer message (notes)
        </label>
        <textarea
          id="chat-intake-message"
          value={rawText}
          onChange={(e) => dispatch({ type: "field", field: "rawText", value: e.target.value })}
          className="min-h-[96px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-xs outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring/40"
          placeholder="What they asked for, delivery notes, etc."
        />
      </div>
      <div>
        <label htmlFor="chat-intake-phone" className="block text-xs font-bold uppercase text-on-surface-variant mb-1">
          Phone
        </label>
        <input
          id="chat-intake-phone"
          value={phone}
          onChange={(e) => dispatch({ type: "field", field: "phone", value: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-xs outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring/40"
          placeholder="Contact number"
        />
      </div>
      <div>
        <label htmlFor="chat-intake-address" className="block text-xs font-bold uppercase text-on-surface-variant mb-1">
          Address (optional)
        </label>
        <textarea
          id="chat-intake-address"
          value={address}
          onChange={(e) => dispatch({ type: "field", field: "address", value: e.target.value })}
          className="min-h-[72px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-xs outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring/40"
          placeholder="Shipping or pickup details"
        />
      </div>

      <div className="space-y-3">
        <label htmlFor="chat-intake-product-search" className="block text-xs font-bold uppercase text-on-surface-variant">
          Products from catalog
        </label>
        <p className="text-xs text-on-surface-variant">
          Search by product name. Picking a row adds a sellable option so a draft order can be created
          in your store.
        </p>
        <div className="relative">
          <input
            id="chat-intake-product-search"
            type="search"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-xs outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring/40"
            placeholder="Type at least 2 characters…"
            value={searchQ}
            onChange={(e) => dispatch({ type: "search", field: "searchQ", value: e.target.value })}
            onFocus={() => dispatch({ type: "search", field: "searchOpen", value: true })}
            onBlur={() => window.setTimeout(() => dispatch({ type: "search", field: "searchOpen", value: false }), 150)}
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
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/80 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Create intake"}
      </button>
    </form>
  );
}
