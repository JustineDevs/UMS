"use client";

import { useEffect, useState } from "react";
import { readResponseJson } from "@/lib/read-response-json";

type Channel =
  | "email"
  | "order_updates"
  | "back_in_stock"
  | "promotions"
  | "wallet"
  | "platform_updates";
type Preference = {
  channel?: Channel;
  consent_status?: "subscribed" | "unsubscribed";
};

function responseErrorMessage(payload: unknown, fallback: string) {
  const error =
    payload && typeof payload === "object" && "error" in payload
      ? (payload as { error?: unknown }).error
      : undefined;
  if (error === "invalid_worker_response" || error === "worker_unavailable") {
    return "Communication preferences are temporarily unavailable. Please try again shortly.";
  }
  return typeof error === "string" && error.trim() ? error : fallback;
}

export function AccountMarketingPreferencesPanel({
  headingId = "account-marketing-preferences-heading",
}: {
  headingId?: string;
}) {
  const [preferences, setPreferences] = useState<Record<Channel, boolean>>({
    email: false,
    order_updates: false,
    back_in_stock: false,
    promotions: false,
    wallet: false,
    platform_updates: false,
  });
  const [state, setState] = useState<"loading" | "ready" | "saving" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    fetch("/api/account/marketing-preferences", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await readResponseJson(response, {} as Record<string, unknown>);
        if (!response.ok)
          throw new Error(responseErrorMessage(payload, "Unable to load communication preferences."));
        const rows = Array.isArray(payload.preferences)
          ? payload.preferences
          : payload.preference
            ? [payload.preference]
            : [];
        setPreferences((current) => ({
          ...current,
          ...Object.fromEntries(
            rows.map((row: Preference) => [
              row.channel ?? "email",
              row.consent_status === "subscribed",
            ]),
          ),
        }));
        setState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setMessage(
          error instanceof Error
            ? error.name === "AbortError"
              ? "Communication preferences are temporarily unavailable. Please try again shortly."
              : error.message
            : "Unable to load communication preferences.",
        );
        setState("error");
      });
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  async function update(channel: Channel, next: boolean) {
    const previous = preferences[channel];
    setPreferences((current) => ({ ...current, [channel]: next }));
    setState("saving");
    setMessage("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch("/api/account/marketing-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, subscribed: next }),
        signal: controller.signal,
      });
      const payload = await readResponseJson(response, {} as Record<string, unknown>);
      if (!response.ok)
        throw new Error(responseErrorMessage(payload, "Unable to save communication preferences."));
      setState("ready");
      setMessage("Communication preferences saved.");
    } catch (error: unknown) {
      setPreferences((current) => ({ ...current, [channel]: previous }));
      setState("error");
      setMessage(
        error instanceof Error
          ? error.name === "AbortError"
            ? "Communication preferences are temporarily unavailable. Please try again shortly."
            : error.message
          : "Unable to save communication preferences.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  function preferenceRow(
    key: string,
    title: string,
    description: string,
    subscribed: boolean,
    onToggle: () => void,
    disabled = false,
  ) {
    return (
      <div key={key} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
        <div>
          <h4 className="text-sm font-semibold text-primary">{title}</h4>
          <p className="mt-1 max-w-xl text-xs leading-5 text-on-surface-variant">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-label={`${subscribed ? "Disable" : "Enable"} ${title}`}
          aria-checked={subscribed}
          disabled={disabled || state === "loading" || state === "saving"}
          onClick={onToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${subscribed ? "justify-end bg-emerald-500" : "justify-start bg-outline-variant/40"}`}
        >
          <span aria-hidden="true" className="mx-0.5 size-5 rounded-full bg-white shadow-sm" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y divide-outline-variant/15">
        <section className="pb-5" aria-labelledby={`${headingId}-email`}>
          <div className="flex items-start justify-between gap-4 border-b border-outline-variant/15 pb-4">
            <div>
              <h3 id={`${headingId}-email`} className="text-lg font-semibold text-primary">Email Notifications</h3>
              <p className="mt-1 text-xs text-on-surface-variant">Important account notifications and reminders cannot be turned off</p>
            </div>
            <span className="relative inline-flex h-6 w-11 shrink-0 items-center justify-end rounded-full bg-emerald-500" aria-label="Email notifications enabled">
              <span className="mx-0.5 size-5 rounded-full bg-white shadow-sm" />
            </span>
          </div>
          <div className="mt-2 pl-5">
            {preferenceRow("email-newsletters", "Newsletters", "New releases, restocks, and store updates", preferences.email, () => void update("email", !preferences.email))}
            {preferenceRow("email-order-updates", "Order Updates", "Updates on shipping and delivery status of all orders", preferences.order_updates, () => void update("order_updates", !preferences.order_updates), true)}
            {preferenceRow("email-promotions", "Promotions", "Exclusive updates on upcoming deals and campaigns", preferences.promotions, () => void update("promotions", !preferences.promotions))}
            {preferenceRow("back-in-stock", "Back-in-stock alerts", "Get notified when a saved product becomes available again", preferences.back_in_stock, () => void update("back_in_stock", !preferences.back_in_stock))}
            {preferenceRow("wallet-updates", "Wallet updates", "Receive updates about wallet activity and account credits", preferences.wallet, () => void update("wallet", !preferences.wallet))}
            {preferenceRow("platform-updates", "Platform updates", "Hear about important storefront changes and service updates", preferences.platform_updates, () => void update("platform_updates", !preferences.platform_updates))}
          </div>
        </section>
      </div>
      <p
        className="mt-3 text-xs text-on-surface-variant"
        role="status"
        aria-live="polite"
      >
        {state === "loading"
          ? "Loading…"
          : message || "Choose the updates you want to receive."}
      </p>
    </div>
  );
}
