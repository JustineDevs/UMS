"use client";

import { useEffect, useState } from "react";

type Action = "remove_and_continue" | "cancel_order" | "ask_me";
const options: Array<{ value: Action; title: string; description: string }> = [
  { value: "remove_and_continue", title: "Ship Available Items Only", description: "Unavailable items will be refunded, and the rest of the order will be shipped." },
  { value: "cancel_order", title: "Cancel The Entire Order", description: "The whole order will be cancelled if any item is unavailable." },
  { value: "ask_me", title: "Ask Me Before Splitting", description: "Pause the order so you can decide what to do when an item is unavailable." },
];

export function AccountOrderPreferencesPanel() {
  const [value, setValue] = useState<Action>("remove_and_continue");
  const [state, setState] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/account/order-preferences", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load order settings.");
      if (payload.preference?.out_of_stock_action) setValue(payload.preference.out_of_stock_action);
      setState("ready");
    }).catch((error: unknown) => { if (!controller.signal.aborted) { setState("error"); setMessage(error instanceof Error ? error.message : "Unable to load order settings."); } });
    return () => controller.abort();
  }, []);
  async function save() {
    const previous = value; setState("saving"); setMessage("");
    try {
      const response = await fetch("/api/account/order-preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outOfStockAction: value }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save order settings.");
      setState("ready"); setMessage("Order settings saved.");
    } catch (error: unknown) { setValue(previous); setState("error"); setMessage(error instanceof Error ? error.message : "Unable to save order settings."); }
  }
  return <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-6 sm:p-7" aria-labelledby="order-preferences-heading">
    <h2 id="order-preferences-heading" className="font-headline text-xl font-bold text-primary">Out of Stock Preference</h2>
    <fieldset className="mt-6 space-y-5" disabled={state === "loading" || state === "saving"}>
      <legend className="sr-only">Unavailable item behavior</legend>
      {options.map((option) => <label key={option.value} className="flex cursor-pointer items-start gap-3">
        <input type="radio" name="out-of-stock-action" value={option.value} checked={value === option.value} onChange={() => setValue(option.value)} className="mt-1 size-4 accent-primary" />
        <span><span className="block text-sm font-semibold text-primary">{option.title}</span><span className="mt-1 block text-xs leading-5 text-on-surface-variant">{option.description}</span></span>
      </label>)}
    </fieldset>
    <button type="button" onClick={() => void save()} disabled={state === "loading" || state === "saving"} className="mt-6 inline-flex min-h-10 items-center rounded bg-primary px-5 py-2 text-sm font-semibold text-on-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
      {state === "saving" ? "Saving…" : "Save"}
    </button>
    <p className="mt-3 text-xs text-on-surface-variant" role="status" aria-live="polite">{state === "loading" ? "Loading…" : message || "Your choice applies to future orders."}</p>
  </section>;
}
