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

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/channels/events?limit=80", { cache: "no-store" });
      const body = await response.json();
      if (response.ok && Array.isArray(body.events)) setEvents(body.events);
    } finally {
      setLoading(false);
    }
  }

  async function markProcessed(id: string) {
    const response = await fetch(`/api/admin/channels/events/${encodeURIComponent(id)}/process`, { method: "POST" });
    if (!response.ok) return;
    setEvents((current) => current.map((event) => event.id === id ? { ...event, processed_at: new Date().toISOString() } : event));
  }

  return (
    <Card>
      <CardContent className="px-0">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <p className="text-sm text-muted-foreground">Signed updates received from connected sales channels.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Channel</TableHead><TableHead>Event</TableHead><TableHead>Received</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {events.length === 0 ? <TableRow><TableCell colSpan={5}><AdminEmptyState title="No channel events yet" description="Signed partner updates will appear here after the first delivery." /></TableCell></TableRow> : events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">{event.channel}</TableCell>
                <TableCell className="text-muted-foreground">{event.event_type}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(event.received_at).toLocaleString()}</TableCell>
                <TableCell>{event.processed_at ? "Processed" : "Needs review"}</TableCell>
                <TableCell className="text-right">{event.processed_at ? <span className="text-xs text-muted-foreground">Complete</span> : <Button type="button" variant="outline" size="sm" onClick={() => void markProcessed(event.id)}>Mark processed</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
