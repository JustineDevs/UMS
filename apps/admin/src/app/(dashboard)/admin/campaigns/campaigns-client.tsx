"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminBreadcrumbs, AdminPageShell, AuditTimeline } from "@/components/admin-console";

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

export function CampaignsPageClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
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
    await fetch("/api/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ name: "", type: "custom", segment_id: "", subject: "", body_template: "" });
    void fetchData();
  }

  async function handleExecute(id: string) {
    setExecuting(id);
    const res = await fetch(`/api/admin/campaigns/${id}/execute`, { method: "POST" });
    if (res.ok) {
      const { sent } = await res.json();
      alert(`Sent ${sent} messages.`);
    }
    setExecuting(null);
    void fetchData();
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
      title="Audience Campaigns"
      subtitle="Email and SMS messaging campaigns for customer segments. Campaigns deliver messages only — price changes require a Medusa Promotion."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Campaigns" }]}
        />
      }
      inspector={<AuditTimeline title="Recent activity" />}
      actions={
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-on-primary transition-opacity hover:opacity-90"
        >
          <span className="material-symbols-outlined text-base">add</span>
          New Campaign
        </button>
      }
    >
      {loading ? (
        <div className="text-center py-20 text-on-surface-variant text-sm">Loading...</div>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((c) => {
            const seg = segments.find((s) => s.id === c.segment_id);
            return (
              <div key={c.id} className="bg-surface-container-lowest rounded-xl p-6 shadow-sm flex items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold font-headline text-sm">{c.name}</h3>
                    <span className="bg-surface-container-high px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                      {typeLabels[c.type] ?? c.type}
                    </span>
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                      Messaging only
                    </span>
                    <span className={`w-2 h-2 rounded-full ${c.is_active ? "bg-emerald-500" : "bg-slate-300"}`} />
                  </div>
                  {c.subject && <p className="text-xs text-on-surface-variant">Subject: {c.subject}</p>}
                  {seg && <p className="text-xs text-on-surface-variant mt-1">Segment: {seg.name} ({seg.member_count} members)</p>}
                  {c.last_run_at && (
                    <p className="text-[10px] text-on-surface-variant mt-2">
                      Last sent: {new Date(c.last_run_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleExecute(c.id)}
                  disabled={executing === c.id || !c.segment_id}
                  className="bg-secondary text-on-secondary px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {executing === c.id ? "Sending..." : "Send Now"}
                </button>
              </div>
            );
          })}
          {campaigns.length === 0 && (
            <div className="text-center py-20 text-sm text-on-surface-variant">
              No campaigns yet. Create your first campaign above.
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-8 space-y-5">
            <h2 className="text-lg font-bold font-headline">Create Campaign</h2>
            <input required placeholder="Campaign name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            <div className="grid grid-cols-2 gap-4">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40">
                <option value="custom">Custom</option>
                <option value="winback">Win-Back</option>
                <option value="birthday">Birthday</option>
                <option value="first_purchase">First Purchase</option>
                <option value="upsell">Upsell</option>
              </select>
              <select value={form.segment_id} onChange={(e) => setForm({ ...form, segment_id: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40">
                <option value="">No segment</option>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.member_count})</option>
                ))}
              </select>
            </div>
            <input placeholder="Email subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            <textarea placeholder="Email body (HTML)" value={form.body_template} onChange={(e) => setForm({ ...form, body_template: e.target.value })} rows={5} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Cancel</button>
              <button type="submit" className="bg-primary text-on-primary px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90">Create</button>
            </div>
          </form>
        </div>
      )}
    </AdminPageShell>
  );
}
