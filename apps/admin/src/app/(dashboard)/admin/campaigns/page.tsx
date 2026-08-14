"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminBreadcrumbs, AdminEmptyState, AdminPageShell, AuditTimeline } from "@/components/admin-console";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Campaign = {
  id: string;
  name: string;
  type: string;
  segment_id: string | null;
  subject: string | null;
  channel: string;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
};

type Segment = {
  id: string;
  name: string;
  member_count: number;
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "custom",
    segment_id: "",
    subject: "",
    body_template: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [campRes, segRes] = await Promise.all([
      fetch("/api/admin/campaigns"),
      fetch("/api/admin/segments"),
    ]);
    if (campRes.ok) {
      const { data } = await campRes.json();
      setCampaigns(data ?? []);
    }
    if (segRes.ok) {
      const { data } = await segRes.json();
      setSegments(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, segment_id: form.segment_id || null }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Campaign could not be created.");
        return;
      }
      setShowForm(false);
      setForm({ name: "", type: "custom", segment_id: "", subject: "", body_template: "" });
      void fetchData();
    } finally {
      setCreating(false);
    }
  }

  async function handleExecute(id: string) {
    setExecuting(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${id}/execute`, {
        method: "POST",
        headers: { "Idempotency-Key": `campaign-${crypto.randomUUID()}` },
      });
      const body = (await res.json().catch(() => ({}))) as { sent?: number; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Campaign could not be sent.");
        return;
      }
      setError(`Campaign sent to ${body.sent ?? 0} recipients.`);
      await fetchData();
    } catch {
      setError("Campaign could not be sent.");
    } finally {
      setExecuting(null);
    }
  }

  async function handleToggle(campaign: Campaign) {
    setError(null);
    const response = await fetch(`/api/admin/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !campaign.is_active }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      setError(body.error ?? "Campaign status could not be changed.");
      return;
    }
    await fetchData();
  }

  const typeLabels: Record<string, string> = {
    winback: "Win-Back",
    birthday: "Birthday",
    first_purchase: "First Purchase",
    upsell: "Upsell",
    custom: "Custom",
  };

  return (
    <AdminPageShell
      title="Campaigns"
      subtitle="Automated and manual email campaigns with segment targeting."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Campaigns" }]}
        />
      }
      inspector={<AuditTimeline title="Recent activity" />}
      actions={
        <Button
          size="sm"
          type="button"
          onClick={() => setShowForm(true)}
        >
          New Campaign
        </Button>
      }
    >
      {error && (
        <p className="mb-4 rounded-lg border border-amber-200/60 bg-amber-50/70 px-4 py-3 text-sm text-amber-950" role="status">
          {error}
        </p>
      )}
      {loading ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading...</div>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((c) => {
            const seg = segments.find((s) => s.id === c.segment_id);
            return (
              <Card key={c.id}>
                <CardContent className="flex items-center gap-6 pt-(--card-spacing)">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-3">
                    <h3 className="truncate text-sm font-medium">{c.name}</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {typeLabels[c.type] ?? c.type}
                    </span>
                    <span className={`h-2 w-2 rounded-full ${c.is_active ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                  </div>
                  {c.subject && <p className="text-xs text-muted-foreground">Subject: {c.subject}</p>}
                  {seg && <p className="mt-1 text-xs text-muted-foreground">Segment: {seg.name} ({seg.member_count} members)</p>}
                  {c.last_run_at && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Last sent: {new Date(c.last_run_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  type="button"
                  onClick={() => handleExecute(c.id)}
                  disabled={executing === c.id || !c.segment_id || !c.is_active}
                >
                  {executing === c.id ? "Sending..." : "Send Now"}
                </Button>
                <Button size="sm" type="button" variant="outline" onClick={() => void handleToggle(c)}>
                  {c.is_active ? "Pause" : "Activate"}
                </Button>
                </CardContent>
              </Card>
            );
          })}
          {campaigns.length === 0 && (
            <AdminEmptyState title="No campaigns yet" description="Create your first campaign to start engaging a customer segment." action={<Button size="sm" onClick={() => setShowForm(true)}>New campaign</Button>} />
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-8 space-y-5">
            <h2 className="text-lg font-bold font-headline">Create Campaign</h2>
            <label className="block text-xs font-semibold text-on-surface-variant" htmlFor="campaign-name">Campaign name
              <input id="campaign-name" required placeholder="Campaign name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-xs font-semibold text-on-surface-variant" htmlFor="campaign-type">Type
              <select id="campaign-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40">
                <option value="custom">Custom</option>
                <option value="winback">Win-Back</option>
                <option value="birthday">Birthday</option>
                <option value="first_purchase">First Purchase</option>
                <option value="upsell">Upsell</option>
              </select>
              </label>
              <label className="block text-xs font-semibold text-on-surface-variant" htmlFor="campaign-segment">Segment
              <select id="campaign-segment" value={form.segment_id} onChange={(e) => setForm({ ...form, segment_id: e.target.value })} className="mt-1 w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40">
                <option value="">No segment</option>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.member_count})</option>
                ))}
              </select>
              </label>
            </div>
            <label className="block text-xs font-semibold text-on-surface-variant" htmlFor="campaign-subject">Email subject
              <input id="campaign-subject" placeholder="Email subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="mt-1 w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            </label>
            <label className="block text-xs font-semibold text-on-surface-variant" htmlFor="campaign-body">Email body
              <textarea id="campaign-body" placeholder="Email body (HTML)" value={form.body_template} onChange={(e) => setForm({ ...form, body_template: e.target.value })} rows={5} className="mt-1 w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            </label>
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>{creating ? "Creating..." : "Create"}</Button>
            </div>
          </form>
        </div>
      )}
    </AdminPageShell>
  );
}
