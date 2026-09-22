"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type LoyaltyResponse = {
  account: {
    points_balance: number;
    lifetime_points: number;
    tier: string;
    updated_at: string;
  } | null;
  transactions: Array<{
    id: string;
    points_delta: number;
    reason: string;
    order_id: string | null;
    created_at: string;
  }>;
};

export function AccountLoyaltyPanel() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<LoyaltyResponse | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void fetch("/api/account/loyalty", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("loyalty_unavailable");
        return (await response.json()) as LoyaltyResponse;
      })
      .then((result) => {
        if (active) {
          setData(result);
          setState("ready");
        }
      })
      .catch((error) => {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) setState("error");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  if (state === "loading") return <p className="text-sm text-on-surface-variant">Loading loyalty wallet…</p>;
  if (state === "error") {
    return <p className="text-sm text-error" role="alert">Loyalty wallet is temporarily unavailable. Refresh and try again.</p>;
  }
  if (!data?.account) {
    return <p className="text-sm text-on-surface-variant">Your loyalty wallet will appear after your first eligible order.</p>;
  }

  return (
    <div className="space-y-6">
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-primary p-4 text-on-primary"><dt className="text-xs text-on-primary/70">Available points</dt><dd className="mt-1 font-headline text-3xl font-bold tabular-nums">{data.account.points_balance.toLocaleString("en-PH")}</dd></div>
        <div className="rounded-xl bg-surface-container-low p-4"><dt className="text-xs text-on-surface-variant">Lifetime points</dt><dd className="mt-1 font-headline text-2xl font-bold text-primary tabular-nums">{data.account.lifetime_points.toLocaleString("en-PH")}</dd></div>
        <div className="rounded-xl bg-surface-container-low p-4"><dt className="text-xs text-on-surface-variant">Tier</dt><dd className="mt-1 font-headline text-2xl font-bold capitalize text-primary">{data.account.tier}</dd></div>
      </dl>
      <div>
        <div className="flex items-end justify-between gap-4 border-b border-outline-variant/15 pb-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Wallet activity</p><h3 className="mt-1 text-lg font-bold text-primary">Recent points history</h3></div><Link href="/help#loyalty" className="text-xs font-semibold text-primary hover:underline">How points work ↗</Link></div>
        {data.transactions.length === 0 ? <p className="py-5 text-sm text-on-surface-variant">No points activity yet.</p> : <ul className="divide-y divide-outline-variant/15">{data.transactions.map((transaction) => <li key={transaction.id} className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-medium text-primary">{transaction.reason}</p><p className="mt-1 text-xs text-on-surface-variant">{new Date(transaction.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" })}{transaction.order_id ? ` · Order ${transaction.order_id}` : ""}</p></div><span className={`text-sm font-bold tabular-nums ${transaction.points_delta >= 0 ? "text-success" : "text-error"}`}>{transaction.points_delta >= 0 ? "+" : ""}{transaction.points_delta}</span></li>)}</ul>}
      </div>
    </div>
  );
}
