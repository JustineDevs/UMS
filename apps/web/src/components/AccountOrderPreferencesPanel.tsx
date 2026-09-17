"use client";

import { useEffect, useState } from "react";

type Action = "remove_and_continue" | "cancel_order" | "ask_me";
const options: Array<{ value: Action; title: string; description: string }> = [
  { value: "remove_and_continue", title: "Remove the unavailable item", description: "Continue with the rest of the order when possible." },
  { value: "cancel_order", title: "Cancel the order", description: "Cancel instead of shipping a partial order." },
  { value: "ask_me", title: "Ask me first", description: "Hold the order for your confirmation." },
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
  async function save(next: Action) {
    const previous = value; setValue(next); setState("saving"); setMessage("");
    try {
      const response = await fetch("/api/account/order-preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outOfStockAction: next }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save order settings.");
      setState("ready"); setMessage("Order settings saved.");
    } catch (error: unknown) { setValue(previous); setState("error"); setMessage(error instanceof Error ? error.message : "Unable to save order settings."); }
  }
  return <div className="mt-6 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5">
    <h3 className="text-sm font-semibold text-primary">Order settings</h3>
    <p className="mt-1 text-xs leading-5 text-on-surface-variant">Choose what should happen if an item becomes unavailable before fulfillment.</p>
    <fieldset className="mt-4 space-y-3" disabled={state === "loading" || state === "saving"}>
      <legend className="sr-only">Unavailable item behavior</legend>
      {options.map((option) => <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant/20 p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
        <input type="radio" name="out-of-stock-action" value={option.value} checked={value === option.value} onChange={() => void save(option.value)} className="mt-1 size-4 accent-primary" />
        <span><span className="block text-sm font-semibold text-primary">{option.title}</span><span className="mt-1 block text-xs leading-5 text-on-surface-variant">{option.description}</span></span>
      </label>)}
    </fieldset>
    <p className="mt-3 text-xs text-on-surface-variant" role="status" aria-live="polite">{state === "loading" ? "Loading…" : message || "Your choice applies to future orders."}</p>
  </div>;
}
