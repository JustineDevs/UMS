"use client";

import { useState } from "react";
import { Button } from "@universal-music-store/ui";
import { AdminEmptyState } from "@/components/admin-console";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ChannelEventRow } from "@/lib/channel-events-bridge";

export function ChannelEventsTable({ initialEvents }: { initialEvents: ChannelEventRow[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/channels/events?limit=80", { cache: "no-store" });
      const body = await response.json();
      if (response.ok && Array.isArray(body.events)) setEvents(body.events);
      else setError("Channel events could not be refreshed. Try again.");
    } catch {
      setError("Channel events could not be refreshed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function markProcessed(id: string) {
    setProcessingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/channels/events/${encodeURIComponent(id)}/process`, {
        method: "POST",
        headers: { "Idempotency-Key": `channel-event-process-${id}` },
      });
      if (!response.ok) {
        setError(response.status === 409 ? "This event was already processed. Refresh the list." : "The event could not be processed. Try again.");
        return;
      }
      const body = await response.json() as { event?: { processed_at?: string } };
      const processedAt = body.event?.processed_at;
      if (!processedAt) {
        setError("The Worker returned an invalid processing result. Refresh the list.");
        return;
      }
      setEvents((current) => current.map((event) => event.id === id ? { ...event, processed_at: processedAt } : event));
    } catch {
      setError("The event could not be processed. Check the connection and try again.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <Card>
      <CardContent className="px-0">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <p className="text-sm text-muted-foreground">Signed updates received from connected sales channels.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</Button>
        </div>
        {error ? <p role="alert" className="border-b px-4 py-3 text-sm text-destructive">{error}</p> : null}
        <Table>
          <TableHeader><TableRow><TableHead>Channel</TableHead><TableHead>Event</TableHead><TableHead>Received</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {events.length === 0 ? <TableRow><TableCell colSpan={5}><AdminEmptyState title="No channel events yet" description="Signed partner updates will appear here after the first delivery." /></TableCell></TableRow> : events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">{event.channel}</TableCell>
                <TableCell className="text-muted-foreground">{event.event_type}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(event.received_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</TableCell>
                <TableCell>{event.processed_at ? "Processed" : "Needs review"}</TableCell>
                <TableCell className="text-right">{event.processed_at ? <span className="text-xs text-muted-foreground">Complete</span> : <Button type="button" variant="outline" size="sm" disabled={processingId !== null} onClick={() => void markProcessed(event.id)}>{processingId === event.id ? "Processing..." : "Mark processed"}</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
