"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
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
      .then((r) => r.json())
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
    return <AdminLoadingState label="Loading offline queue" />;
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
      <AdminSection title="Queue filters" description="Filter pending sales by the device that created them.">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4">
        <label className="block min-w-[200px] flex-1 text-sm">
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
                  {new Date(row.created_at).toLocaleString()}
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
