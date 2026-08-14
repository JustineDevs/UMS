"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminBreadcrumbs, AdminPageShell, AuditTimeline } from "@/components/admin-console";
import { Button } from "@/components/ui/button";

type Device = {
  id: string;
  name: string;
  type: string;
  ip_address: string | null;
  is_active: boolean;
  config: Record<string, unknown>;
  last_seen_at: string | null;
  created_at: string;
};

type EditForm = {
  ip_address: string;
  printerHost: string;
  printerPort: string;
  defaultAdapter: string;
  httpRelayUrl: string;
  epsonEposUrl: string;
  qzTrayRelayUrl: string;
};

const STALE_THRESHOLD_MS = 15 * 60 * 1000;

function isStaleDevice(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() > STALE_THRESHOLD_MS;
}

const ADAPTER_OPTIONS_BASE = [
  { value: "escpos-tcp", label: "ESC/POS TCP" },
  { value: "http-relay", label: "HTTP relay" },
  { value: "qz-tray", label: "QZ Tray relay" },
  { value: "star-cloudprnt", label: "Star CloudPRNT" },
  { value: "epson-epos", label: "Epson HTTP raw" },
] as const;

const ADAPTER_OPTIONS = ADAPTER_OPTIONS_BASE;

function configToEditForm(d: Device): EditForm {
  const c = d.config ?? {};
  const tcp = c.printerTcp as { host?: string; port?: number } | undefined;
  return {
    ip_address: d.ip_address ?? "",
    printerHost: typeof tcp?.host === "string" ? tcp.host : "",
    printerPort:
      typeof tcp?.port === "number" && Number.isFinite(tcp.port)
        ? String(tcp.port)
        : "",
    defaultAdapter:
      typeof c.defaultAdapter === "string" && c.defaultAdapter
        ? c.defaultAdapter
        : "escpos-tcp",
    httpRelayUrl: typeof c.httpRelayUrl === "string" ? c.httpRelayUrl : "",
    epsonEposUrl: typeof c.epsonEposUrl === "string" ? c.epsonEposUrl : "",
    qzTrayRelayUrl:
      typeof c.qzTrayRelayUrl === "string" ? c.qzTrayRelayUrl : "",
  };
}

function buildConfigPatch(form: EditForm): Record<string, unknown> {
  const printerTcp: { host?: string; port?: number } = {};
  if (form.printerHost.trim()) {
    printerTcp.host = form.printerHost.trim();
  }
  const portNum = Number.parseInt(form.printerPort, 10);
  if (form.printerPort.trim() && Number.isFinite(portNum)) {
    printerTcp.port = portNum;
  }
  const out: Record<string, unknown> = {
    defaultAdapter: form.defaultAdapter,
  };
  if (Object.keys(printerTcp).length > 0) {
    out.printerTcp = printerTcp;
  }
  if (form.httpRelayUrl.trim()) out.httpRelayUrl = form.httpRelayUrl.trim();
  if (form.epsonEposUrl.trim()) out.epsonEposUrl = form.epsonEposUrl.trim();
  if (form.qzTrayRelayUrl.trim()) {
    out.qzTrayRelayUrl = form.qzTrayRelayUrl.trim();
  }
  return out;
}

export function DevicesPageClient() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "terminal", ip_address: "" });
  const [editing, setEditing] = useState<Device | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/devices");
    if (res.ok) {
      const { data } = await res.json();
      setDevices(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchDevices();
  }, [fetchDevices]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const response = await fetch("/api/admin/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Device could not be registered.");
      return;
    }
    setShowForm(false);
    setForm({ name: "", type: "terminal", ip_address: "" });
    void fetchDevices();
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editForm) return;
    setSaving(true);
    setError(null);
    const config = buildConfigPatch(editForm);
    const response = await fetch(`/api/admin/devices/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ip_address: editForm.ip_address.trim() || null,
        config,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Device could not be updated.");
      setSaving(false);
      return;
    }
    setSaving(false);
    setEditing(null);
    setEditForm(null);
    void fetchDevices();
  }

  function openEdit(d: Device) {
    setEditing(d);
    setEditForm(configToEditForm(d));
  }

  const typeIcons: Record<string, string> = {
    terminal: "dock",
    printer: "print",
    kds: "monitor",
    scanner: "qr_code_scanner",
  };

  return (
    <AdminPageShell
      title="Devices"
      subtitle="Register and manage POS terminals, printers, and kitchen displays. Printer and adapter settings sync when the device name matches your terminal profile."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Devices" }]}
        />
      }
      actions={
        <Button type="button" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-base">add</span>
          Add Device
        </Button>
      }
      inspector={<AuditTimeline title="Recent activity" />}
    >
      {error && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="text-center py-20 text-on-surface-variant text-sm">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((d) => (
            <div key={d.id} className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-surface-container-high rounded-lg flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-on-surface-variant">
                      {typeIcons[d.type] ?? "devices"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold font-headline text-sm truncate">{d.name}</h3>
                    <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">{d.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`w-2.5 h-2.5 rounded-full mt-1 ${d.is_active ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(d)}>
                    Edit
                  </Button>
                </div>
              </div>
              {d.ip_address && <p className="text-xs text-on-surface-variant mt-3">IP: {d.ip_address}</p>}
              {d.last_seen_at && (
                <p className="text-[10px] text-on-surface-variant mt-1">
                  Last seen: {new Date(d.last_seen_at).toLocaleString()}
                </p>
              )}
              {isStaleDevice(d.last_seen_at) && (
                <div className="mt-2 flex items-center gap-1.5 rounded bg-amber-50 border border-amber-200 px-2.5 py-1">
                  <span className="material-symbols-outlined text-xs text-amber-600">warning</span>
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                    Device inactive ({">"}15 min)
                  </p>
                </div>
              )}
            </div>
          ))}
          {devices.length === 0 && (
            <div className="col-span-full text-center py-20 text-sm text-on-surface-variant">
              No devices registered. Add your first device above.
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8 space-y-5">
            <h2 className="text-lg font-bold font-headline">Add Device</h2>
            <input required placeholder="Device name (e.g. Terminal 01)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40">
              <option value="terminal">Terminal</option>
              <option value="printer">Printer</option>
              <option value="kds">Kitchen Display</option>
              <option value="scanner">Scanner</option>
            </select>
            <input placeholder="IP Address (optional)" value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit">Add</Button>
            </div>
          </form>
        </div>
      )}

      {editing && editForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSaveEdit} className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8 space-y-4 my-8">
            <h2 className="text-lg font-bold font-headline">Edit device: {editing.name}</h2>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">IP address</label>
            <input
              value={editForm.ip_address}
              onChange={(e) => setEditForm({ ...editForm, ip_address: e.target.value })}
              className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm"
              placeholder="Optional"
            />
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant pt-2">Printer TCP (ESC/POS)</label>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={editForm.printerHost}
                onChange={(e) => setEditForm({ ...editForm, printerHost: e.target.value })}
                className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm"
                placeholder="Host"
              />
              <input
                value={editForm.printerPort}
                onChange={(e) => setEditForm({ ...editForm, printerPort: e.target.value })}
                className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm"
                placeholder="Port (e.g. 9100)"
              />
            </div>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">Default adapter</label>
            <select
              value={editForm.defaultAdapter}
              onChange={(e) => setEditForm({ ...editForm, defaultAdapter: e.target.value })}
              className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm"
            >
              {ADAPTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">HTTP relay URL</label>
            <input
              value={editForm.httpRelayUrl}
              onChange={(e) => setEditForm({ ...editForm, httpRelayUrl: e.target.value })}
              className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm"
              placeholder="https://... or http://127.0.0.1:..."
            />
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">Epson raw print URL</label>
            <input
              value={editForm.epsonEposUrl}
              onChange={(e) => setEditForm({ ...editForm, epsonEposUrl: e.target.value })}
              className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm"
              placeholder="Optional"
            />
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">QZ Tray relay URL</label>
            <input
              value={editForm.qzTrayRelayUrl}
              onChange={(e) => setEditForm({ ...editForm, qzTrayRelayUrl: e.target.value })}
              className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm"
              placeholder="Optional"
            />
            <div className="flex gap-3 justify-end pt-4">
              <Button
                variant="outline"
                type="button"
                disabled={saving}
                onClick={() => {
                  setEditing(null);
                  setEditForm(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </AdminPageShell>
  );
}
