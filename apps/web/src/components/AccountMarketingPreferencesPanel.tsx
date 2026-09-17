"use client";

import { useEffect, useState } from "react";

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

const channels: Array<{ id: Channel; title: string; description: string }> = [
  {
    id: "email",
    title: "Newsletter",
    description: "New releases, restocks, and store updates.",
  },
  {
    id: "order_updates",
    title: "Order updates",
    description: "Order confirmation, delivery, and status messages.",
  },
  {
    id: "back_in_stock",
    title: "Back in stock",
    description: "Alerts when a subscribed product becomes available.",
  },
  {
    id: "promotions",
    title: "Promotions",
    description: "Sale alerts and campaign offers.",
  },
  {
    id: "wallet",
    title: "Wallet updates",
    description: "Loyalty balance, credits, and wallet activity.",
  },
  {
    id: "platform_updates",
    title: "Store updates",
    description: "Important service and account announcements.",
  },
];

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
    fetch("/api/account/marketing-preferences", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok)
          throw new Error(
            payload.error || "Unable to load communication preferences.",
          );
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
            ? error.message
            : "Unable to load communication preferences.",
        );
        setState("error");
      });
    return () => controller.abort();
  }, []);

  async function update(channel: Channel, next: boolean) {
    const previous = preferences[channel];
    setPreferences((current) => ({ ...current, [channel]: next }));
    setState("saving");
    setMessage("");
    try {
      const response = await fetch("/api/account/marketing-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, subscribed: next }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.error || "Unable to save communication preferences.",
        );
      setState("ready");
      setMessage("Communication preferences saved.");
    } catch (error: unknown) {
      setPreferences((current) => ({ ...current, [channel]: previous }));
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save communication preferences.",
      );
    }
  }

  return (
    <div>
      <div>
        <h3 id={headingId} className="text-sm font-semibold text-primary">
          Notifications
        </h3>
        <p className="mt-1 max-w-xl text-xs leading-5 text-on-surface-variant">
          Choose the updates you want to receive. You can change these at any
          time.
        </p>
      </div>
      <div className="mt-5 divide-y divide-outline-variant/15">
        {channels.map((channel) => {
          const subscribed = preferences[channel.id];
          return (
            <div
              key={channel.id}
              className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div>
                <h4 className="text-sm font-semibold text-primary">
                  {channel.title}
                </h4>
                <p className="mt-1 max-w-xl text-xs leading-5 text-on-surface-variant">
                  {channel.description}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-label={`${subscribed ? "Disable" : "Enable"} ${channel.title}`}
                aria-checked={subscribed}
                disabled={state === "loading" || state === "saving"}
                onClick={() => void update(channel.id, !subscribed)}
                className={`relative inline-flex min-h-11 min-w-20 shrink-0 items-center rounded-full border px-2 text-xs font-semibold transition disabled:opacity-60 ${subscribed ? "justify-end border-primary bg-primary text-on-primary" : "justify-start border-outline-variant/40 bg-surface-container-low text-on-surface-variant"}`}
              >
                <span
                  aria-hidden="true"
                  className="size-7 rounded-full bg-surface-container-lowest shadow-sm"
                />
              </button>
            </div>
          );
        })}
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
