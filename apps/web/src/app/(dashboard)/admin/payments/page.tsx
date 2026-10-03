"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle2, Clock3, Filter, RefreshCw, Search } from "lucide-react";

import { AdminPageHeader, AdminPageShell } from "@/components/admin-console";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

type AttemptRow = {
  correlationId: string;
  cartId: string;
  provider: string;
  status: string;
  checkoutState: string;
  medusaOrderId: string | null;
  quoteFingerprint: string | null;
  staleReason: string | null;
  invalidatedAt: string | null;
  invalidatedBy: string | null;
  lastError: string | null;
  finalizeAttempts: number;
  updatedAt: string;
};

type RecoveryBucket = { day: string; count: number };

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "default";
  if (status === "failed") return "destructive";
  if (status === "expired" || status === "needs_review") return "secondary";
  return "outline";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [buckets, setBuckets] = useState<RecoveryBucket[]>([]);
  const [invalidations, setInvalidations] = useState<number | null>(null);
  const [days, setDays] = useState("14");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [attemptView, setAttemptView] = useState<"latest" | "upcoming">("latest");
  const [statusFilter, setStatusFilter] = useState("all");
  const [orderQuery, setOrderQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [attemptsResponse, recoveryResponse] = await Promise.all([
        fetch("/api/admin/payments?limit=100"),
        fetch(`/api/admin/commerce-recovery-metrics?days=${days}`),
      ]);
      if (!attemptsResponse.ok) {
        const body = (await attemptsResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load payment attempts (${attemptsResponse.status})`);
      }
      if (!recoveryResponse.ok) {
        const body = (await recoveryResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load recovery metrics (${recoveryResponse.status})`);
      }
      const attempts = (await attemptsResponse.json()) as { attempts?: AttemptRow[]; error?: string };
      const recovery = (await recoveryResponse.json()) as {
        buckets?: RecoveryBucket[];
        totalInvalidationsInWindow?: number;
        error?: string;
      };
      setRows(attempts.attempts ?? []);
      setBuckets(recovery.buckets ?? []);
      setInvalidations(typeof recovery.totalInvalidationsInWindow === "number" ? recovery.totalInvalidationsInWindow : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load payment operations");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  async function mutateAttempt(correlationId: string, action: "retry" | "review") {
    setBusy(`${action}:${correlationId}`);
    try {
      const response = await fetch(`/api/admin/payments/${encodeURIComponent(correlationId)}/${action === "retry" ? "retry" : "mark-review"}`, {
        method: "POST",
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(result.error ?? `${action === "retry" ? "Retry" : "Review"} failed (${response.status})`);
      }
      await load();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Payment operation failed");
    } finally {
      setBusy(null);
    }
  }

  const summary = useMemo(() => {
    const completed = rows.filter((row) => row.status === "completed").length;
    const needsAttention = rows.filter((row) => ["failed", "expired", "needs_review"].includes(row.status)).length;
    const inProgress = rows.filter((row) => !["completed", "failed", "expired", "needs_review"].includes(row.status)).length;
    return { completed, needsAttention, inProgress };
  }, [rows]);

  const maxRecovery = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const visibleRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return sorted.filter((row) => {
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      const matchesView = attemptView === "latest" || !["completed", "failed", "expired"].includes(row.status);
      const matchesOrder = !orderQuery.trim() || (row.medusaOrderId ?? "").toLowerCase().includes(orderQuery.trim().toLowerCase());
      return matchesStatus && matchesView && matchesOrder;
    });
  }, [attemptView, orderQuery, rows, statusFilter]);

  return (
    <AdminPageShell hideHeader>
      <div className="flex flex-col gap-6">
        <AdminPageHeader
          title="Payments & recovery"
          subtitle="Monitor payment finalization, recover stale checkout sessions, and resolve exceptions from one operational ledger."
          actions={
            <Button onClick={() => void load()} size="sm" variant="outline" disabled={loading}>
              <RefreshCw data-icon="inline-start" className={loading ? "animate-spin" : undefined} />
              Refresh
            </Button>
          }
        />

        {error ? (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-normal text-muted-foreground text-sm">Total attempts</CardTitle>
              <CardDescription className="text-3xl text-foreground tabular-nums leading-none tracking-tight">{loading ? "-" : rows.length.toLocaleString()}</CardDescription>
              <CardAction className="grid size-7 place-items-center rounded-md bg-muted"><Clock3 className="size-4" /></CardAction>
            </CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">Hosted checkout and COD ledger rows</p></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-normal text-muted-foreground text-sm">Completed</CardTitle>
              <CardDescription className="text-3xl text-foreground tabular-nums leading-none tracking-tight">{loading ? "-" : summary.completed.toLocaleString()}</CardDescription>
              <CardAction className="grid size-7 place-items-center rounded-md bg-muted"><CheckCircle2 className="size-4" /></CardAction>
            </CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">Successfully finalized payments</p></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-normal text-muted-foreground text-sm">Needs attention</CardTitle>
              <CardDescription className="text-3xl text-foreground tabular-nums leading-none tracking-tight">{loading ? "-" : summary.needsAttention.toLocaleString()}</CardDescription>
              <CardAction className="grid size-7 place-items-center rounded-md bg-muted"><AlertCircle className="size-4" /></CardAction>
            </CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">Failed, expired, or review states</p></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-normal text-muted-foreground text-sm">Recovery signals</CardTitle>
              <CardDescription className="text-3xl text-foreground tabular-nums leading-none tracking-tight">{loading ? "-" : (invalidations ?? 0).toLocaleString()}</CardDescription>
              <CardAction className="grid size-7 place-items-center rounded-md bg-muted"><ArrowDownRight className="size-4" /></CardAction>
            </CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">Invalidations in the last {days} days</p></CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.6fr)]">
          <Card className="min-w-0">
            <CardHeader className="relative pr-36">
              <CardTitle className="font-normal">Recovery activity</CardTitle>
              <CardDescription>Stale-session invalidations by UTC day</CardDescription>
              <CardAction className="absolute right-6 top-6">
                <Select value={days} onValueChange={setDays}>
                  <SelectTrigger aria-label="Recovery window" className="w-28" size="sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="flex h-52 items-end gap-2 border-b border-border/60 px-2 pb-0 pt-6 sm:gap-3">
                {buckets.length ? buckets.map((bucket) => (
                  <div className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2" key={bucket.day} title={`${bucket.day}: ${bucket.count}`}>
                    <span className="text-muted-foreground text-xs tabular-nums">{bucket.count}</span>
                    <div className="w-full max-w-10 rounded-t-md bg-primary/75 transition-[height] duration-300" style={{ height: `${Math.max(8, (bucket.count / maxRecovery) * 130)}px` }} />
                    <span className="max-w-full truncate text-muted-foreground text-[10px]">{bucket.day.slice(5)}</span>
                  </div>
                )) : <div className="flex w-full items-center justify-center pb-20 text-center text-sm text-muted-foreground">No recovery activity in this window.</div>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-normal">Operational health</CardTitle>
              <CardDescription>Current ledger state</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5"><span className="text-sm">In progress</span><span className="font-medium tabular-nums">{summary.inProgress}</span></div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5"><span className="text-sm">Review queue</span><span className="font-medium tabular-nums">{summary.needsAttention}</span></div>
              <div className="rounded-lg bg-muted px-3 py-3 text-sm text-muted-foreground">Retrying a payment calls the storefront finalizer using the configured internal reconciliation channel.</div>
            </CardContent>
          </Card>
        </div>

        <section className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm" aria-labelledby="payment-attempts-title">
          <div className="flex flex-col gap-4 border-b border-border/60 p-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2"><h2 id="payment-attempts-title" className="text-lg font-semibold tracking-tight">Transactions</h2><Badge variant="outline">{rows.length} records</Badge></div>
              <p className="mt-1 text-sm text-muted-foreground">Review and retry payment finalization events</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-lg bg-muted p-1" aria-label="Payment transaction view">
                  <Button type="button" variant={attemptView === "latest" ? "secondary" : "ghost"} size="sm" aria-pressed={attemptView === "latest"} onClick={() => setAttemptView("latest")}>Latest</Button>
                  <Button type="button" variant={attemptView === "upcoming" ? "secondary" : "ghost"} size="sm" aria-pressed={attemptView === "upcoming"} onClick={() => setAttemptView("upcoming")}>Upcoming</Button>
                </div>
                <label className="relative min-w-56 flex-1 sm:max-w-xs">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input aria-label="Search payment transactions by order ID" className="h-9 pl-9" onChange={(event) => setOrderQuery(event.target.value)} placeholder="Search order ID..." value={orderQuery} />
                </label>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger size="sm" className="w-36" aria-label="Filter payment transactions by status"><Filter className="size-3.5" /><SelectValue placeholder="Filter status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="initiated">Initiated</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="needs_review">Needs review</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="min-w-0 overflow-x-auto">
            <Table className="w-full min-w-0 table-fixed md:min-w-[940px] md:table-auto">
              <TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30"><TableHead>Transaction</TableHead><TableHead className="w-[5.5rem] md:w-auto">Status</TableHead><TableHead className="hidden md:table-cell">Order</TableHead><TableHead className="hidden md:table-cell">Attempts</TableHead><TableHead className="hidden md:table-cell">Updated</TableHead><TableHead className="w-[6.25rem] text-right md:w-auto">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow key={row.correlationId}>
                    <TableCell className="min-w-0 align-top"><div className="truncate font-medium capitalize">Payment via {row.provider}</div><div className="mt-1 truncate text-xs text-muted-foreground md:max-w-[280px]">{row.staleReason ?? row.lastError ?? "No exception recorded"}</div></TableCell>
                    <TableCell className="w-[5.5rem] align-top md:w-auto"><Badge variant={statusVariant(row.status)} className="max-w-full truncate capitalize">{row.status.replace(/[_-]/g, " ")}</Badge><div className="mt-1 truncate text-xs text-muted-foreground">{row.checkoutState.replace(/[_-]/g, " ")}</div></TableCell>
                    <TableCell className="hidden max-w-[210px] truncate font-mono text-xs md:table-cell">{row.medusaOrderId ?? "—"}</TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">{row.finalizeAttempts}</TableCell>
                    <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground md:table-cell">{formatDate(row.updatedAt)}</TableCell>
                    <TableCell className="w-[6.25rem] align-top md:w-auto"><div className="flex flex-col items-stretch gap-1 md:flex-row md:justify-end md:gap-2"><Button disabled={busy !== null || row.status === "completed"} onClick={() => void mutateAttempt(row.correlationId, "retry")} size="sm" variant="outline"><ArrowUpRight data-icon="inline-start" />Retry</Button><Button disabled={busy !== null} onClick={() => void mutateAttempt(row.correlationId, "review")} size="sm" variant="ghost">Review</Button></div></TableCell>
                  </TableRow>
                ))}
                {!loading && visibleRows.length === 0 ? <TableRow><TableCell className="h-32 text-center text-muted-foreground" colSpan={6}>{rows.length ? "No transactions match this view." : "No payment attempts yet."}</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t border-border/60 px-5 py-3 text-xs text-muted-foreground"><span>Showing {visibleRows.length} of {rows.length} records</span><span>Latest updates first</span></div>
        </section>
      </div>
    </AdminPageShell>
  );
}
