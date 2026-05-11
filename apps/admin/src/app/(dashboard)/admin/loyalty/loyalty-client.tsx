"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminBreadcrumbs, AdminPageShell, AuditTimeline } from "@/components/admin-console";

type LoyaltyAccount = {
  id: string;
  customer_email: string;
  points_balance: number;
  lifetime_points: number;
  tier: string;
  qr_token: string | null;
  phone: string | null;
  created_at: string;
};

type Reward = {
  id: string;
  name: string;
  points_cost: number;
  reward_type: string;
  is_active: boolean;
};

export function LoyaltyPageClient() {
  const [tab, setTab] = useState<"accounts" | "rewards">("accounts");
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollEmail, setEnrollEmail] = useState("");
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [rewardForm, setRewardForm] = useState({ name: "", points_cost: "", reward_type: "discount" });
  const [pointsModal, setPointsModal] = useState<LoyaltyAccount | null>(null);
  const [pointsAmount, setPointsAmount] = useState("");
  const [pointsReason, setPointsReason] = useState("");
  const [lookupValue, setLookupValue] = useState("");

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/loyalty");
    if (res.ok) {
      const { data } = await res.json();
      setAccounts(data ?? []);
    }
    setLoading(false);
  }, []);

  const fetchRewards = useCallback(async () => {
    const res = await fetch("/api/admin/loyalty/rewards");
    if (res.ok) {
      const { data } = await res.json();
      setRewards(data ?? []);
    }
  }, []);

  useEffect(() => {
    void fetchAccounts();
    void fetchRewards();
  }, [fetchAccounts, fetchRewards]);

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/loyalty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: enrollEmail }),
    });
    setShowEnroll(false);
    setEnrollEmail("");
    void fetchAccounts();
  }

  async function handleCreateReward(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/loyalty/rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: rewardForm.name,
        points_cost: Number(rewardForm.points_cost),
        reward_type: rewardForm.reward_type,
      }),
    });
    setShowRewardForm(false);
    setRewardForm({ name: "", points_cost: "", reward_type: "discount" });
    void fetchRewards();
  }

  async function handleAddPoints(e: React.FormEvent) {
    e.preventDefault();
    if (!pointsModal) return;
    await fetch("/api/admin/loyalty/points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: pointsModal.id,
        points: Number(pointsAmount),
        reason: pointsReason,
      }),
    });
    setPointsModal(null);
    setPointsAmount("");
    setPointsReason("");
    void fetchAccounts();
  }

  async function handleLookup() {
    if (!lookupValue.trim()) return;
    const isPhone = /^[+0-9]/.test(lookupValue);
    const param = isPhone ? `phone=${encodeURIComponent(lookupValue)}` : `qr=${encodeURIComponent(lookupValue)}`;
    const res = await fetch(`/api/admin/loyalty/lookup?${param}`);
    if (res.ok) {
      const { data } = await res.json();
      if (data) {
        setAccounts([data]);
      }
    }
  }

  const tierColor: Record<string, string> = {
    standard: "bg-slate-100 text-slate-600",
    silver: "bg-slate-200 text-slate-700",
    gold: "bg-amber-100 text-amber-700",
    platinum: "bg-purple-100 text-purple-700",
  };

  return (
    <AdminPageShell
      title="Loyalty Program"
      subtitle="Customer rewards, points tracking, and tier management."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Loyalty" }]}
        />
      }
      inspector={<AuditTimeline title="Recent activity" />}
      actions={
        <button
          type="button"
          onClick={() => setShowEnroll(true)}
          className="bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-on-primary transition-opacity hover:opacity-90"
        >
          Enroll Customer
        </button>
      }
    >
      <div className="mb-6 flex gap-4">
        <div className="flex bg-surface-container-low rounded-lg p-1">
          <button onClick={() => setTab("accounts")} className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded ${tab === "accounts" ? "bg-white shadow-sm text-primary" : "text-on-surface-variant"}`}>
            Accounts ({accounts.length})
          </button>
          <button onClick={() => setTab("rewards")} className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded ${tab === "rewards" ? "bg-white shadow-sm text-primary" : "text-on-surface-variant"}`}>
            Rewards ({rewards.length})
          </button>
        </div>
        <div className="flex-1 flex gap-2">
          <input
            value={lookupValue}
            onChange={(e) => setLookupValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            placeholder="Lookup by phone or QR token..."
            className="flex-1 border border-outline-variant/20 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary/40"
          />
          <button onClick={handleLookup} className="bg-surface-container-high px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-surface-dim transition-colors rounded">
            Search
          </button>
          <button onClick={fetchAccounts} className="text-xs text-on-surface-variant hover:underline px-2">
            Reset
          </button>
        </div>
      </div>

      {tab === "accounts" && (
        loading ? (
          <div className="text-center py-20 text-on-surface-variant text-sm">Loading...</div>
        ) : (
          <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-container-low text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  <th className="text-left px-6 py-4">Customer</th>
                  <th className="text-right px-6 py-4">Balance</th>
                  <th className="text-right px-6 py-4">Lifetime</th>
                  <th className="text-center px-6 py-4">Tier</th>
                  <th className="text-right px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-t border-outline-variant/10 hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium">{a.customer_email}</p>
                      {a.phone && <p className="text-xs text-on-surface-variant">{a.phone}</p>}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold">{a.points_balance.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-sm text-on-surface-variant">{a.lifetime_points.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${tierColor[a.tier] ?? "bg-slate-100"}`}>
                        {a.tier}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => setPointsModal(a)} className="text-xs text-primary hover:underline">
                        Adjust Points
                      </button>
                    </td>
                  </tr>
                ))}
                {accounts.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-on-surface-variant">No loyalty accounts found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === "rewards" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowRewardForm(true)} className="bg-secondary text-on-secondary px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity">
              Add Reward
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewards.map((r) => (
              <div key={r.id} className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
                <h3 className="font-bold font-headline text-sm">{r.name}</h3>
                <p className="text-xs text-on-surface-variant mt-1 capitalize">{r.reward_type}</p>
                <p className="text-2xl font-extrabold mt-3">{r.points_cost.toLocaleString()}</p>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">points required</p>
              </div>
            ))}
            {rewards.length === 0 && (
              <p className="text-sm text-on-surface-variant col-span-full text-center py-12">No rewards configured.</p>
            )}
          </div>
        </div>
      )}

      {showEnroll && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleEnroll} className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8 space-y-5">
            <h2 className="text-lg font-bold font-headline">Enroll Customer</h2>
            <input required type="email" placeholder="Customer email" value={enrollEmail} onChange={(e) => setEnrollEmail(e.target.value)} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" autoFocus />
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowEnroll(false)} className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Cancel</button>
              <button type="submit" className="bg-primary text-on-primary px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90">Enroll</button>
            </div>
          </form>
        </div>
      )}

      {showRewardForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateReward} className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8 space-y-5">
            <h2 className="text-lg font-bold font-headline">Create Reward</h2>
            <input required placeholder="Reward name" value={rewardForm.name} onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            <input required type="number" min="1" placeholder="Points cost" value={rewardForm.points_cost} onChange={(e) => setRewardForm({ ...rewardForm, points_cost: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            <select value={rewardForm.reward_type} onChange={(e) => setRewardForm({ ...rewardForm, reward_type: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40">
              <option value="discount">Discount</option>
              <option value="free_item">Free Item</option>
              <option value="free_shipping">Free Shipping</option>
              <option value="custom">Custom</option>
            </select>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowRewardForm(false)} className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Cancel</button>
              <button type="submit" className="bg-primary text-on-primary px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90">Create</button>
            </div>
          </form>
        </div>
      )}

      {pointsModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddPoints} className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8 space-y-5">
            <h2 className="text-lg font-bold font-headline">Adjust Points</h2>
            <p className="text-sm text-on-surface-variant">{pointsModal.customer_email}</p>
            <p className="text-xs text-on-surface-variant">Current balance: {pointsModal.points_balance.toLocaleString()}</p>
            <input required type="number" placeholder="Points (negative to deduct)" value={pointsAmount} onChange={(e) => setPointsAmount(e.target.value)} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            <input required placeholder="Reason" value={pointsReason} onChange={(e) => setPointsReason(e.target.value)} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setPointsModal(null)} className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Cancel</button>
              <button type="submit" className="bg-primary text-on-primary px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90">Submit</button>
            </div>
          </form>
        </div>
      )}
    </AdminPageShell>
  );
}
