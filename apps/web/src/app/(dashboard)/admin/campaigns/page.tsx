"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { AdminBreadcrumbs, AdminEmptyState, AdminPageShell } from "@/components/admin-console";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@universal-music-store/ui";

type Campaign = {
  id: string;
  name: string;
  type: string;
  segment_id: string | null;
  subject: string | null;
  channel: string;
  is_active: boolean;
  last_run_at: string | null;
  schedule_cron: string | null;
  created_at: string;
};

type Segment = {
  id: string;
  name: string;
  member_count: number;
};

const TYPE_LABELS: Record<string, string> = {
  winback: "Win-Back",
  birthday: "Birthday",
  first_purchase: "First Purchase",
  upsell: "Upsell",
  custom: "Custom",
};

function CampaignMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="border border-border/70 shadow-none">
      <CardContent className="space-y-3 pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function CampaignWorkspaceSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading campaign workspace" aria-busy="true">
      <section aria-label="Campaign overview metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="border border-border/70 shadow-none">
            <CardContent className="space-y-3 pt-4">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </section>
      <Card className="border border-border/70 shadow-none">
        <CardContent className="space-y-5 pt-5">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-4 w-24" />
          </div>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex items-center gap-4 border-b border-border/50 pb-5 last:border-0 last:pb-0">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CampaignsPage() {
  const creatingRef = useRef(false);
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
    setError(null);
    try {
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
      if (!campRes.ok || !segRes.ok) {
        setError("Campaign data could not be fully loaded. Retry to refresh the workspace.");
      }
    } catch {
      setError("Campaign data could not be loaded. Retry to refresh the workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!showForm) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowForm(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showForm]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating || creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `campaign-create-${crypto.randomUUID()}`,
        },
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
      creatingRef.current = false;
      setCreating(false);
    }
  }

  async function handleExecute(id: string) {
    if (executing) return;
    setExecuting(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${id}/execute`, {
        method: "POST",
        headers: { "Idempotency-Key": `campaign-${crypto.randomUUID()}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Campaign could not be sent.");
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { sent?: number };
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
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `campaign-toggle-${crypto.randomUUID()}`,
      },
      body: JSON.stringify({ is_active: !campaign.is_active }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      setError(body.error ?? "Campaign status could not be changed.");
      return;
    }
    await fetchData();
  }

  const activeCampaigns = campaigns.filter((campaign) => campaign.is_active).length;
  const scheduledCampaigns = campaigns.filter((campaign) => campaign.schedule_cron).length;
  const latestRun = campaigns
    .map((campaign) => campaign.last_run_at)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const subtitle = loading
    ? "Monitor active, scheduled, and recent campaign delivery."
    : `${activeCampaigns} active · ${scheduledCampaigns} scheduled · ${campaigns.length} total campaigns`;

  return (
    <AdminPageShell
      title="Campaigns"
      subtitle={subtitle}
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Campaigns" }]}
        />
      }
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
      {loading ? <CampaignWorkspaceSkeleton /> : (
        <div className="space-y-6">
          <section aria-labelledby="campaign-overview-title">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 id="campaign-overview-title" className="text-sm font-semibold text-foreground">Campaign overview</h2>
              <p className="text-xs text-muted-foreground">{latestRun ? `Last activity ${new Date(latestRun).toLocaleDateString()}` : "No sends recorded yet"}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <CampaignMetric label="Total campaigns" value={String(campaigns.length)} detail="Across all campaign types" />
              <CampaignMetric label="Active" value={String(activeCampaigns)} detail="Eligible for scheduled runs" />
              <CampaignMetric label="Scheduled" value={String(scheduledCampaigns)} detail="Configured with a schedule" />
              <CampaignMetric label="Segments" value={String(segments.length)} detail="Available audience groups" />
            </div>
          </section>

          <section aria-labelledby="campaign-list-title">
            <Card className="border border-border/70 shadow-none">
              <CardContent className="space-y-5 pt-5">
                <div className="flex flex-col gap-1 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div>
                    <h2 id="campaign-list-title" className="text-sm font-semibold text-foreground">Campaigns</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Review audience, delivery state, and manual send actions.</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"}</span>
                </div>
                <div className="space-y-3">
                  {campaigns.map((campaign) => {
                    const segment = segments.find((item) => item.id === campaign.segment_id);
                    return (
                      <div key={campaign.id} className="flex flex-col gap-4 rounded-lg border border-border/60 p-4 sm:flex-row sm:items-center sm:gap-6">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-3">
                            <h3 className="truncate text-sm font-medium">{campaign.name}</h3>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                              {TYPE_LABELS[campaign.type] ?? campaign.type}
                            </span>
                            <span
                              className={`h-2 w-2 rounded-full ${campaign.is_active ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                              aria-label={campaign.is_active ? "Active" : "Paused"}
                              title={campaign.is_active ? "Active" : "Paused"}
                            />
                          </div>
                          {campaign.subject && <p className="text-xs text-muted-foreground">Subject: {campaign.subject}</p>}
                          {segment && <p className="mt-1 text-xs text-muted-foreground">Segment: {segment.name} ({segment.member_count} members)</p>}
                          <p className="mt-2 text-xs text-muted-foreground">
                            {campaign.schedule_cron ? "Scheduled delivery" : "Manual delivery"}
                            {campaign.last_run_at ? ` · Last sent ${new Date(campaign.last_run_at).toLocaleDateString()}` : " · No sends yet"}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            size="sm"
                            type="button"
                            onClick={() => handleExecute(campaign.id)}
                            disabled={executing === campaign.id || !campaign.segment_id || !campaign.is_active}
                          >
                            {executing === campaign.id ? "Sending..." : "Send Now"}
                          </Button>
                          <Button size="sm" type="button" variant="outline" onClick={() => void handleToggle(campaign)}>
                            {campaign.is_active ? "Pause" : "Activate"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {campaigns.length === 0 && (
                    <AdminEmptyState title="No campaigns yet" description="Create your first campaign to start engaging a customer segment." action={<Button size="sm" onClick={() => setShowForm(true)}>New campaign</Button>} />
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      )}

      {showForm && typeof document !== "undefined" ? createPortal(
        <dialog
          open
          className="fixed inset-0 z-[100] m-0 flex h-dvh w-dvw max-w-none items-center justify-center overflow-y-auto border-0 bg-black/40 p-4 sm:p-6"
          aria-labelledby="create-campaign-title"
          onCancel={(event) => {
            event.preventDefault();
            setShowForm(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setShowForm(false);
          }}
          tabIndex={-1}
        >
          <form onSubmit={handleCreate} className="my-auto max-h-[calc(100dvh_-_2rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-2xl sm:p-8">
            <h2 id="create-campaign-title" className="text-lg font-bold font-headline">Create Campaign</h2>
            <label className="block text-xs font-semibold text-on-surface-variant" htmlFor="campaign-name">Campaign name
              <input id="campaign-name" required placeholder="Campaign name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </dialog>,
        document.body,
      ) : null}
    </AdminPageShell>
  );
}
