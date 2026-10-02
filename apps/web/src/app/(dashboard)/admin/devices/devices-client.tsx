"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { AdminBreadcrumbs, AdminPageShell } from "@/components/admin-console";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@universal-music-store/ui";
import { AlertTriangle, Monitor, PackagePlus, Printer, ScanLine, Store } from "lucide-react";

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

const TYPE_ICONS = {
  terminal: Store,
  printer: Printer,
  kds: Monitor,
  scanner: ScanLine,
};

function ModalPortal({ children }: { children: React.ReactNode }) {
  return typeof document === "undefined" ? null : createPortal(children, document.body);
}

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

function DeviceWorkspaceSkeleton() {
  return (
    <section className="space-y-4" aria-label="Loading registered hardware" aria-busy="true">
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-full max-w-72" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index} className="border-border/70 shadow-none">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-lg" />
                <div className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-16" /></div>
              </div>
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function DevicesPageClient() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "terminal", ip_address: "" });
  const [editing, setEditing] = useState<Device | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const creatingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/devices");
      if (res.ok) {
        const { data } = await res.json();
        setDevices(data ?? []);
      } else {
        setError("Device data could not be loaded. Retry to refresh the hardware workspace.");
      }
    } catch {
      setError("Device data could not be loaded. Retry to refresh the hardware workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    if (!showForm && !editing) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (editing) {
        setEditing(null);
        setEditForm(null);
      } else {
        setShowForm(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [editing, showForm]);

  useEffect(() => {
    if (!showForm && !editing) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editing, showForm]);

  function openCreate() {
    setCreateError(null);
    setForm({ name: "", type: "terminal", ip_address: "" });
    setShowForm(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creatingRef.current) return;
    creatingRef.current = true;
    setError(null);
    setCreateError(null);
    try {
      const response = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setCreateError(body.error ?? "Device could not be registered.");
        return;
      }
      setShowForm(false);
      setCreateError(null);
      setForm({ name: "", type: "terminal", ip_address: "" });
      void fetchDevices();
    } finally {
      creatingRef.current = false;
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editForm) return;
    setSaving(true);
    setError(null);
    const config = buildConfigPatch(editForm);
    try {
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
        return;
      }
      setEditing(null);
      setEditForm(null);
      void fetchDevices();
    } finally {
      setSaving(false);
    }
  }

  function openEdit(d: Device) {
    setEditing(d);
    setEditForm(configToEditForm(d));
  }

  return (
    <AdminPageShell
      title="Devices"
      subtitle={loading ? "Manage active POS terminals, printers, and displays." : `${devices.length} registered hardware ${devices.length === 1 ? "device" : "devices"}`}
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Devices" }]}
        />
      }
      actions={
        devices.length > 0 ? (
          <Button type="button" onClick={openCreate}>
            <PackagePlus className="size-4" aria-hidden="true" />
            Add Device
          </Button>
        ) : null
      }
    >
      {error && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
          {error}
        </p>
      )}
      {loading ? <DeviceWorkspaceSkeleton /> : (
        <section aria-labelledby="registered-hardware-title" className="space-y-4 rounded-xl border border-border/70 bg-card p-5 shadow-none sm:p-6">
          <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="registered-hardware-title" className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">Registered hardware</h2>
              <p className="mt-1 text-sm text-muted-foreground">Monitor POS terminals, receipt printers, and kitchen displays.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {devices.map((d) => (
            <Card key={d.id} className="border-border/70 shadow-none">
              <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    {(() => { const DeviceIcon = TYPE_ICONS[d.type as keyof typeof TYPE_ICONS] ?? Monitor; return <DeviceIcon className="size-5 text-on-surface-variant" aria-hidden="true" />; })()}
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
              {d.ip_address && <p className="mt-3 text-xs text-on-surface-variant">IP: {d.ip_address}</p>}
              {d.last_seen_at && (
                <p className="text-[10px] text-on-surface-variant mt-1">
                  Last seen: {new Date(d.last_seen_at).toLocaleString()}
                </p>
              )}
              {isStaleDevice(d.last_seen_at) && (
                <div className="mt-2 flex items-center gap-1.5 rounded bg-amber-50 border border-amber-200 px-2.5 py-1">
                  <AlertTriangle className="size-3 text-amber-600" aria-hidden="true" />
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                    Device inactive ({">"}15 min)
                  </p>
                </div>
              )}
              </CardContent>
            </Card>
          ))}
          {devices.length === 0 && (
            <div className="col-span-full flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
              <div className="mb-4 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground"><Monitor className="size-6" aria-hidden="true" /></div>
              <h3 className="text-base font-semibold text-foreground">No registered devices</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">Connect your first POS terminal or printer to start monitoring your hardware.</p>
              <Button type="button" size="sm" className="mt-5 gap-2" onClick={openCreate}><PackagePlus className="size-4" aria-hidden="true" />Link first device</Button>
            </div>
          )}
          </div>
        </section>
      )}

      {showForm && (
        <ModalPortal>
        <dialog
          open
          tabIndex={-1}
          className="fixed inset-0 z-[100] m-0 flex h-dvh w-dvw max-w-none items-center justify-center overflow-y-auto border-0 bg-black/50 p-4 sm:p-6"
          aria-labelledby="add-device-title"
          aria-describedby="add-device-description"
          onMouseDown={(event) => {
            if (!creatingRef.current && event.target === event.currentTarget) setShowForm(false);
          }}
          onCancel={(event) => { event.preventDefault(); setShowForm(false); }}
          onKeyDown={(event) => { if (event.key === "Escape") setShowForm(false); }}
        >
          <form onSubmit={handleCreate} className="my-auto flex max-h-[calc(100dvh_-_2rem)] w-full max-w-sm flex-col gap-5 overflow-y-auto rounded-xl border border-border bg-background p-5 text-foreground shadow-2xl sm:p-7">
            <div className="space-y-1">
              <h2 id="add-device-title" className="text-xl font-bold font-headline">Add Device</h2>
              <p id="add-device-description" className="text-sm text-muted-foreground">Register a POS terminal, printer, display, or scanner.</p>
            </div>
            {createError ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{createError}</p> : null}
            <div className="space-y-2">
              <label htmlFor="add-device-name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Device name</label>
              <input id="add-device-name" autoFocus required placeholder="e.g. Terminal 01" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30" />
            </div>
            <div className="space-y-2">
              <label htmlFor="add-device-type" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Device type</label>
              <select id="add-device-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30">
                <option value="terminal">Terminal</option>
                <option value="printer">Printer</option>
                <option value="kds">Kitchen Display</option>
                <option value="scanner">Scanner</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="add-device-ip" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">IP address <span className="font-normal normal-case tracking-normal">(optional)</span></label>
              <input id="add-device-ip" inputMode="decimal" placeholder="192.168.1.100" value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30" />
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" className="sm:min-w-20">Add</Button>
            </div>
          </form>
        </dialog>
        </ModalPortal>
      )}

      {editing && editForm && (
        <ModalPortal>
        <dialog open tabIndex={-1} aria-labelledby="edit-device-title" className="fixed inset-0 z-[100] m-0 flex h-dvh w-dvw max-w-none items-center justify-center overflow-y-auto border-0 bg-black/40 p-4 sm:p-6" onCancel={(event) => { event.preventDefault(); setEditing(null); }}>
          <form onSubmit={handleSaveEdit} className="my-auto max-h-[calc(100dvh_-_2rem)] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-2xl sm:p-8">
            <h2 id="edit-device-title" className="text-lg font-bold font-headline">Edit device: {editing.name}</h2>
            <label htmlFor="device-edit-ip-address" className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">IP address</label>
            <input
              id="device-edit-ip-address"
              value={editForm.ip_address}
              onChange={(e) => setEditForm({ ...editForm, ip_address: e.target.value })}
              className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm"
              placeholder="Optional"
            />
            <span className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant pt-2">Printer TCP (ESC/POS)</span>
            <div className="grid grid-cols-2 gap-3">
              <input
                aria-label="Printer host"
                value={editForm.printerHost}
                onChange={(e) => setEditForm({ ...editForm, printerHost: e.target.value })}
                className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm"
                placeholder="Host"
              />
              <input
                aria-label="Printer port"
                value={editForm.printerPort}
                onChange={(e) => setEditForm({ ...editForm, printerPort: e.target.value })}
                className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm"
                placeholder="Port (e.g. 9100)"
              />
            </div>
            <label htmlFor="device-edit-default-adapter" className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">Default adapter</label>
            <select
              id="device-edit-default-adapter"
              value={editForm.defaultAdapter}
              onChange={(e) => setEditForm({ ...editForm, defaultAdapter: e.target.value })}
              className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm"
            >
              {ADAPTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <label htmlFor="device-edit-http-relay-url" className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">HTTP relay URL</label>
            <input
              id="device-edit-http-relay-url"
              value={editForm.httpRelayUrl}
              onChange={(e) => setEditForm({ ...editForm, httpRelayUrl: e.target.value })}
              className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm"
              placeholder="https://... or http://127.0.0.1:..."
            />
            <label htmlFor="device-edit-epson-url" className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">Epson raw print URL</label>
            <input
              id="device-edit-epson-url"
              value={editForm.epsonEposUrl}
              onChange={(e) => setEditForm({ ...editForm, epsonEposUrl: e.target.value })}
              className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm"
              placeholder="Optional"
            />
            <label htmlFor="device-edit-qz-url" className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">QZ Tray relay URL</label>
            <input
              id="device-edit-qz-url"
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
        </dialog>
        </ModalPortal>
      )}
    </AdminPageShell>
  );
}
