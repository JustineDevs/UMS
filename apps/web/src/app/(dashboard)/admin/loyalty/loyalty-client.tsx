"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AdminBreadcrumbs,
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
  AdminPageShell,
  AdminSection,
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
import type { CrmCustomerRow } from "@/lib/customer-admin-bridge";

type LoyaltyPageClientProps = {
  customers: CrmCustomerRow[];
};

function ModalPortal({ children }: { children: ReactNode }) {
  return typeof document === "undefined" ? null : createPortal(children, document.body);
}

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

const TIER_COLORS: Record<string, string> = {
  standard: "bg-slate-100 text-slate-600",
  silver: "bg-slate-200 text-slate-700",
  gold: "bg-amber-100 text-amber-700",
  platinum: "bg-purple-100 text-purple-700",
};

export function LoyaltyPageClient({ customers = [] }: LoyaltyPageClientProps) {
  const [tab, setTab] = useState<"accounts" | "rewards">("accounts");
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollEmail, setEnrollEmail] = useState("");
  const [enrollSearch, setEnrollSearch] = useState("");
  const [enrollSort, setEnrollSort] = useState<"name" | "email" | "newest">("name");
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [rewardForm, setRewardForm] = useState({ name: "", points_cost: "", reward_type: "discount" });
  const [pointsModal, setPointsModal] = useState<LoyaltyAccount | null>(null);
  const [pointsAmount, setPointsAmount] = useState("");
  const [pointsReason, setPointsReason] = useState("");
  const [lookupValue, setLookupValue] = useState("");
  const mutationBusyRef = useRef(false);

  const enrolledEmails = new Set(accounts.map((account) => account.customer_email.toLowerCase()));
  const search = enrollSearch.trim().toLowerCase();
  const enrollableCustomers = customers
    .filter((customer) => {
      if (!customer.email || enrolledEmails.has(customer.email.toLowerCase())) return false;
      if (!search) return true;
      return [customer.email, customer.first_name, customer.last_name]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search));
    })
    .sort((left, right) => {
      if (enrollSort === "newest") return right.created_at.localeCompare(left.created_at);
      if (enrollSort === "email") return (left.email ?? "").localeCompare(right.email ?? "");
      return `${left.first_name ?? ""} ${left.last_name ?? ""} ${left.email ?? ""}`
        .trim()
        .localeCompare(`${right.first_name ?? ""} ${right.last_name ?? ""} ${right.email ?? ""}`.trim());
    });

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

  useEffect(() => {
    if (!showEnroll && !showRewardForm && !pointsModal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (pointsModal) setPointsModal(null);
      else if (showRewardForm) setShowRewardForm(false);
      else setShowEnroll(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [pointsModal, showEnroll, showRewardForm]);

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (mutationBusyRef.current) return;
    mutationBusyRef.current = true;
    try { await fetch("/api/admin/loyalty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: enrollEmail }),
    });
      setShowEnroll(false);
      setEnrollEmail("");
      void fetchAccounts();
    } finally { mutationBusyRef.current = false; }
  }

  async function handleCreateReward(e: React.FormEvent) {
    e.preventDefault();
    if (mutationBusyRef.current) return;
    mutationBusyRef.current = true;
    try { await fetch("/api/admin/loyalty/rewards", {
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
    } finally { mutationBusyRef.current = false; }
  }

  async function handleAddPoints(e: React.FormEvent) {
    e.preventDefault();
    if (!pointsModal) return;
    if (mutationBusyRef.current) return;
    mutationBusyRef.current = true;
    try { await fetch("/api/admin/loyalty/points", {
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
    } finally { mutationBusyRef.current = false; }
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

  return (
    <AdminPageShell
      title="Loyalty Program"
      subtitle="Customer rewards, points tracking, and tier management."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Loyalty" }]}
        />
      }
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
          <AdminLoadingState label="Loading loyalty accounts" />
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
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_COLORS[a.tier] ?? "bg-muted text-muted-foreground"}`}>
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
        <ModalPortal>
          <dialog open aria-labelledby="enroll-customer-title" className="fixed inset-0 z-[100] m-0 flex h-dvh w-dvw max-w-none items-center justify-center overflow-y-auto border-0 bg-black/40 p-4 sm:p-6">
          <form onSubmit={handleEnroll} className="flex max-h-[min(720px,max(0px,calc(100dvh_-_2rem)))] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="border-b border-border px-6 py-5">
              <h2 id="enroll-customer-title" className="text-lg font-bold font-headline">Enroll Customer</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose an existing customer to add to the loyalty program.</p>
            </div>
            <div className="flex min-h-0 flex-col gap-4 p-6">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  aria-label="Search customers to enroll"
                  placeholder="Search by name or email..."
                  value={enrollSearch}
                  onChange={(event) => setEnrollSearch(event.target.value)}
                  autoFocus
                  className="flex-1"
                />
                <select
                  aria-label="Sort customers to enroll"
                  value={enrollSort}
                  onChange={(event) => setEnrollSort(event.target.value as typeof enrollSort)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="name">Name A–Z</option>
                  <option value="email">Email A–Z</option>
                  <option value="newest">Newest first</option>
                </select>
              </div>
              <div className="min-h-0 overflow-y-auto rounded-lg border border-border" role="radiogroup" aria-label="Customers available for enrollment">
                {enrollableCustomers.length > 0 ? enrollableCustomers.map((customer) => {
                  const email = customer.email!;
                  const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ");
                  return (
                    <label key={customer.id} className="flex cursor-pointer items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/50">
                      <input
                        type="radio"
                        name="enroll-customer"
                        value={email}
                        checked={enrollEmail === email}
                        onChange={() => setEnrollEmail(email)}
                        required
                        className="size-4 accent-primary"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{name || email}</span>
                        {name ? <span className="block truncate text-xs text-muted-foreground">{email}</span> : null}
                      </span>
                    </label>
                  );
                }) : (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {customers.length === 0 ? "No customers are available." : "No customers match this search or all customers are already enrolled."}
                  </p>
                )}
              </div>
            </div>
            <div className="flex w-full justify-end gap-3 border-t border-border px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setShowEnroll(false)}>Cancel</Button>
              <Button type="submit" disabled={!enrollEmail || enrollableCustomers.length === 0}>Enroll</Button>
            </div>
          </form>
          </dialog>
        </ModalPortal>
      )}

      {showRewardForm && (
        <ModalPortal>
          <dialog open tabIndex={-1} aria-labelledby="create-reward-title" className="fixed inset-0 z-[100] m-0 flex h-dvh w-dvw max-w-none items-center justify-center overflow-y-auto border-0 bg-black/40 p-4 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowRewardForm(false); }} onKeyDown={(event) => { if (event.key === "Escape") setShowRewardForm(false); }}>
            <form onSubmit={handleCreateReward} className="my-auto flex max-h-[calc(100dvh_-_2rem)] w-full max-w-md flex-col gap-5 overflow-y-auto rounded-xl border border-border bg-background p-5 text-foreground shadow-2xl sm:p-7">
              <div>
                <h2 id="create-reward-title" className="text-lg font-bold font-headline">Create Reward</h2>
                <p className="mt-1 text-sm text-muted-foreground">Define the points cost and benefit customers can redeem.</p>
              </div>
              <div className="grid gap-4">
                <label className="grid gap-1.5 text-sm font-medium" htmlFor="reward-name">Reward name
                  <Input id="reward-name" autoFocus required placeholder="e.g. 10% off accessories" value={rewardForm.name} onChange={(event) => setRewardForm({ ...rewardForm, name: event.target.value })} />
                </label>
                <label className="grid gap-1.5 text-sm font-medium" htmlFor="reward-points">Points cost
                  <Input id="reward-points" required type="number" min="1" inputMode="numeric" placeholder="e.g. 500" value={rewardForm.points_cost} onChange={(event) => setRewardForm({ ...rewardForm, points_cost: event.target.value })} />
                </label>
                <label className="grid gap-1.5 text-sm font-medium" htmlFor="reward-type">Reward type
                  <select id="reward-type" aria-label="Reward type" value={rewardForm.reward_type} onChange={(event) => setRewardForm({ ...rewardForm, reward_type: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                    <option value="discount">Discount</option>
                    <option value="free_item">Free Item</option>
                    <option value="free_shipping">Free Shipping</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setShowRewardForm(false)}>Cancel</Button>
                <Button className="w-full sm:w-auto" type="submit">Create</Button>
              </div>
            </form>
          </dialog>
        </ModalPortal>
      )}

      {pointsModal && (
        <ModalPortal>
          <dialog open aria-labelledby="adjust-points-title" className="fixed inset-0 z-[100] m-0 flex h-dvh w-dvw max-w-none items-center justify-center overflow-y-auto border-0 bg-black/40 p-4 sm:p-6">
          <form onSubmit={handleAddPoints} className="my-auto max-h-[calc(100dvh_-_2rem)] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-5 shadow-2xl sm:p-8 space-y-5">
            <h2 id="adjust-points-title" className="text-lg font-bold font-headline">Adjust Points</h2>
            <p className="text-sm text-on-surface-variant">{pointsModal.customer_email}</p>
            <p className="text-xs text-on-surface-variant">Current balance: {pointsModal.points_balance.toLocaleString()}</p>
            <input aria-label="Points adjustment" required type="number" placeholder="Points (negative to deduct)" value={pointsAmount} onChange={(e) => setPointsAmount(e.target.value)} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            <input aria-label="Points adjustment reason" required placeholder="Reason" value={pointsReason} onChange={(e) => setPointsReason(e.target.value)} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setPointsModal(null)}>Cancel</Button>
              <Button type="submit">Submit</Button>
            </div>
          </form>
          </dialog>
        </ModalPortal>
      )}
    </AdminPageShell>
  );
}
