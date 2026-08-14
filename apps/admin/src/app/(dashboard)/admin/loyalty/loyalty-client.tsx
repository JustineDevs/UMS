"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AdminBreadcrumbs,
  AdminEmptyState,
  AdminErrorState,
  AdminPageShell,
  AdminSection,
  AuditTimeline,
} from "@/components/admin-console";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  const [loadError, setLoadError] = useState<string | null>(null);
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
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/loyalty");
      if (!res.ok) throw new Error("Loyalty accounts could not be loaded.");
      const { data } = await res.json();
      setAccounts(data ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Loyalty accounts could not be loaded.");
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
        <Button
          size="sm"
          type="button"
          onClick={() => setShowEnroll(true)}
        >
          Enroll Customer
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-fit rounded-lg bg-muted p-1">
          <Button variant={tab === "accounts" ? "outline" : "ghost"} size="sm" onClick={() => setTab("accounts")}>
            Accounts ({accounts.length})
          </Button>
          <Button variant={tab === "rewards" ? "outline" : "ghost"} size="sm" onClick={() => setTab("rewards")}>
            Rewards ({rewards.length})
          </Button>
        </div>
        <div className="flex flex-1 flex-wrap gap-2 sm:justify-end">
          <Input
            className="min-w-56 sm:max-w-xs"
            value={lookupValue}
            onChange={(e) => setLookupValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            placeholder="Lookup by phone or QR token..."
          />
          <Button variant="outline" size="sm" onClick={handleLookup}>
            Search
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchAccounts}>
            Reset
          </Button>
        </div>
      </div>

      {tab === "accounts" && (
        loading ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading...</div>
        ) : loadError ? (
          <AdminErrorState title="Loyalty unavailable" detail={loadError} onRetry={() => void fetchAccounts()} />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Lifetime</TableHead>
                  <TableHead className="text-center">Tier</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{a.customer_email}</p>
                      {a.phone && <p className="text-xs text-muted-foreground">{a.phone}</p>}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{a.points_balance.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">{a.lifetime_points.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tierColor[a.tier] ?? "bg-muted text-muted-foreground"}`}>
                        {a.tier}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="link" size="sm" onClick={() => setPointsModal(a)}>
                        Adjust Points
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {accounts.length === 0 && (
                  <TableRow><TableCell colSpan={5}><AdminEmptyState title="No loyalty accounts found" description="Enroll a customer or search by phone or QR token to get started." /></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        )
      )}

      {tab === "rewards" && (
        <AdminSection
          title="Rewards"
          description="Configure the rewards customers can redeem with their points."
          actions={<Button size="sm" onClick={() => setShowRewardForm(true)}>
              Add Reward
            </Button>}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rewards.map((r) => (
              <Card key={r.id}>
                <CardHeader><CardTitle className="text-sm">{r.name}</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs capitalize text-muted-foreground">{r.reward_type}</p>
                  <p className="mt-3 text-2xl font-semibold tabular-nums">{r.points_cost.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">points required</p>
                </CardContent>
              </Card>
            ))}
            {rewards.length === 0 && (
              <div className="col-span-full"><AdminEmptyState title="No rewards configured" description="Create a reward to make points redeemable." action={<Button size="sm" onClick={() => setShowRewardForm(true)}>Add reward</Button>} /></div>
            )}
          </div>
        </AdminSection>
      )}

      </div>

      {showEnroll && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleEnroll} className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8 space-y-5">
            <h2 className="text-lg font-bold font-headline">Enroll Customer</h2>
            <input required type="email" placeholder="Customer email" value={enrollEmail} onChange={(e) => setEnrollEmail(e.target.value)} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" autoFocus />
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowEnroll(false)}>Cancel</Button>
              <Button type="submit">Enroll</Button>
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
              <Button type="button" variant="outline" onClick={() => setShowRewardForm(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
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
              <Button type="button" variant="outline" onClick={() => setPointsModal(null)}>Cancel</Button>
              <Button type="submit">Submit</Button>
            </div>
          </form>
        </div>
      )}
    </AdminPageShell>
  );
}
