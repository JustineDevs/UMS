"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle2, Clock3, RefreshCw } from "lucide-react";

import { AdminPageHeader, AdminPageShell } from "@/components/admin-console";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [attemptsResponse, recoveryResponse] = await Promise.all([
        fetch("/api/admin/payments?limit=100"),
        fetch(`/api/admin/commerce-recovery-metrics?days=${days}`),
      ]);
      const attempts = (await attemptsResponse.json()) as { attempts?: AttemptRow[]; error?: string };
      const recovery = (await recoveryResponse.json()) as {
        buckets?: RecoveryBucket[];
        totalInvalidationsInWindow?: number;
        error?: string;
      };
      if (!attemptsResponse.ok) throw new Error(attempts.error ?? "Failed to load payment attempts");
      if (!recoveryResponse.ok) throw new Error(recovery.error ?? "Failed to load recovery metrics");
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
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? `${action === "retry" ? "Retry" : "Review"} failed`);
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
            <CardHeader>
              <CardTitle className="font-normal">Recovery activity</CardTitle>
              <CardDescription>Stale-session invalidations by UTC day</CardDescription>
              <CardAction>
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

        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="font-normal">Payment attempts</CardTitle>
            <CardDescription>Review and retry payment finalization events</CardDescription>
            <CardAction><Badge variant="outline">{rows.length} records</Badge></CardAction>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1050px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead><TableHead>Status</TableHead><TableHead>Reason</TableHead><TableHead>Order</TableHead><TableHead>Attempts</TableHead><TableHead>Updated</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.correlationId}>
                      <TableCell className="font-medium">{row.provider}</TableCell>
                      <TableCell><Badge variant={statusVariant(row.status)}>{row.status}</Badge><div className="mt-1 text-muted-foreground text-xs">{row.checkoutState}</div></TableCell>
                      <TableCell className="max-w-[270px] truncate text-muted-foreground text-sm">{row.staleReason ?? row.lastError ?? "No exception recorded"}</TableCell>
                      <TableCell className="font-mono text-xs">{row.medusaOrderId ?? "-"}</TableCell>
                      <TableCell className="tabular-nums">{row.finalizeAttempts}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{formatDate(row.updatedAt)}</TableCell>
                      <TableCell><div className="flex justify-end gap-2"><Button disabled={busy !== null || row.status === "completed"} onClick={() => void mutateAttempt(row.correlationId, "retry")} size="sm" variant="outline"><ArrowUpRight data-icon="inline-start" />Retry</Button><Button disabled={busy !== null} onClick={() => void mutateAttempt(row.correlationId, "review")} size="sm" variant="ghost">Review</Button></div></TableCell>
                    </TableRow>
                  ))}
                  {!loading && rows.length === 0 ? <TableRow><TableCell className="h-32 text-center text-muted-foreground" colSpan={7}>No payment attempts yet.</TableCell></TableRow> : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminPageShell>
  );
}
