"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminEmptyState,
  AdminErrorState,
  AdminSection,
} from "@/components/admin-console";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type QueueItem = {
  id: string;
  device_name: string;
  employee_id: string | null;
  payload: Record<string, unknown>;
  status: string;
  error_message: string | null;
  created_at: string;
  synced_at: string | null;
};

export function OfflineQueuePanel() {
  const [device, setDevice] = useState("");
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (device.trim()) params.set("device", device.trim());
    setError(null);
    setItems(null);
    fetch(`/api/admin/offline-queue?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Offline queue request failed (${r.status})`);
        return r.json();
      })
      .then((body) => {
        if (body.error) {
          setError(body.error);
          setItems([]);
          return;
        }
        setItems((body.data as QueueItem[]) ?? []);
      })
      .catch(() => {
        setError("Unable to load offline queue");
        setItems([]);
      });
  }, [device]);

  useEffect(() => {
    load();
  }, [load]);

  if (items === null && !error) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading offline queue">
        <div className="grid gap-4 sm:grid-cols-3">
          {["Cached records", "Last sync", "Sync health"].map((label) => (
            <Card key={label}>
              <CardContent className="space-y-3 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                <div className="h-7 w-24 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            {[1, 2, 3].map((row) => <div key={row} className="h-12 animate-pulse rounded bg-muted/70" />)}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return <AdminErrorState title="Queue data unavailable" detail={error} />;
  }

  if (!items?.length) {
    return (
      <AdminEmptyState
        title="No pending offline sales"
        description="POS devices enqueue sales here when the network drops. Items clear after a successful sync."
        action={
          <Button type="button" onClick={() => load()}>
            Refresh
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cached records</p><p className="mt-2 text-2xl font-semibold">{items.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Queue source</p><p className="mt-2 text-sm font-medium">POS local cache</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sync health</p><p className="mt-2 inline-flex items-center gap-2 text-sm font-medium"><span className="size-2 rounded-full bg-emerald-500" /> Ready to sync</p></CardContent></Card>
      </div>
      <AdminSection title="Queue filters" description="Filter pending sales by the device that created them.">
      <Card>
        <CardContent className="flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block min-w-0 flex-1 text-sm sm:min-w-[200px]">
          <span className="text-sm font-medium">Device filter</span>
          <Input
            value={device}
            onChange={(e) => setDevice(e.target.value)}
            className="mt-2"
            placeholder="Optional device name"
          />
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => load()}
        >
          Apply
        </Button>
        </CardContent>
      </Card>
      </AdminSection>

      <AdminSection title="Pending sales" description={`${items.length} sales waiting for synchronization.`}>
      <Card>
        <CardContent className="overflow-x-auto px-0">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {items.map((row) => (
              <TableRow
                key={row.id}
              >
                <TableCell className="align-top font-medium">
                  {row.device_name}
                </TableCell>
                <TableCell className="align-top text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
                </TableCell>
                <TableCell className="align-top">
                  <pre className="max-h-40 max-w-xl overflow-auto rounded-lg bg-muted p-2 font-mono text-[11px] text-foreground">
                    {JSON.stringify(row.payload, null, 2)}
                  </pre>
                </TableCell>
              </TableRow>
            ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </AdminSection>
    </div>
  );
}
