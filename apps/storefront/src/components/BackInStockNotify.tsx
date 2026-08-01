"use client";

import { useState } from "react";
import posthog from "posthog-js";

type Props = {
  productId: string;
  productSlug: string;
  variantId?: string;
};

export function BackInStockNotify({ productId, productSlug, variantId }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/back-in-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), productId, productSlug, variantId }),
      });
      if (res.ok) {
        posthog.capture("back_in_stock_notification_requested", {
          product_id: productId,
          product_slug: productSlug,
          ...(variantId ? { variant_id: variantId } : {}),
        });
        setStatus("done");
        setMessage("We will notify you when this item is back in stock.");
      } else {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Could not submit. Check your connection and try again.");
    }
  }

  if (status === "done") {
    return (
      <p className="text-sm text-primary font-medium" role="status">
        {message}
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low/60 p-4">
      <p className="mb-3 text-sm font-medium text-on-surface">
        This item is currently out of stock. Enter your email to be notified when it is available.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          disabled={status === "loading"}
          className="min-w-0 flex-1 rounded border border-outline-variant/40 bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === "loading" || !email.trim()}
          className="shrink-0 rounded bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-primary hover:opacity-90 disabled:opacity-40"
        >
          {status === "loading" ? "Saving..." : "Notify me"}
        </button>
      </form>
      {status === "error" && (
        <p className="mt-2 text-xs text-error" role="alert">{message}</p>
      )}
    </div>
  );
}
