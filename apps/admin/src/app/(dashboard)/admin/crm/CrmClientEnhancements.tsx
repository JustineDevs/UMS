"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import Nango from "@nangohq/frontend";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@universal-music-store/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CrmCustomerRoster } from "./CrmCustomerRoster";
import type { CrmNangoConnection, CrmNangoIntegration } from "@/lib/crm-nango";

type Segment = {
  id: string;
  name: string;
  description: string | null;
  rule_type: string;
  member_count: number;
  last_refreshed_at: string | null;
};

type ClvResult = {
  customer_email: string;
  total_spent: number;
  order_count: number;
  avg_order_value: number;
};

type BridgeConnection = {
  id: string;
  provider_config_key: string;
  connection_id: string;
  connection_name: string | null;
  organization_id: string | null;
  branch_id: string | null;
  staff_email: string | null;
  sync_scope: string;
  active: boolean;
  updated_at: string;
};

type BridgeRecord = {
  id: string;
  provider_config_key: string;
  local_entity_type: "contact" | "deal";
  local_record_id: string;
  local_record_label: string | null;
  external_record_id: string | null;
  sync_state: string;
  sync_mode: string;
  updated_at: string;
};

type BridgeMapping = {
  id: string;
  customer_email: string;
  medusa_customer_id: string | null;
  nango_connection_id: string | null;
  external_contact_id: string | null;
  sync_state: string;
  updated_at: string;
};

type BridgeSupportApp = {
  provider_config_key: string;
  label: string;
  category: string;
};

type BridgeResponse = {
  connections: BridgeConnection[];
  records: BridgeRecord[];
  mappings: BridgeMapping[];
  supportedApps: BridgeSupportApp[];
};

type Customer = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  has_account: boolean;
  created_at: string;
};

type SupportedApp = {
  provider_config_key: string;
  label: string;
  category: string;
  description: string;
};

type ActivePanel =
  | "segments"
  | "clv"
  | "connection"
  | "record"
  | "connected"
  | "records"
  | "mappings"
  | "catalog"
  | "roster";

const emptyBridgeResponse: BridgeResponse = {
  connections: [],
  records: [],
  mappings: [],
  supportedApps: [],
};

export function CrmClientEnhancements({
  customers,
  registeredCount,
  supportedApps,
}: {
  customers: Customer[];
  registeredCount: number;
  supportedApps: readonly SupportedApp[];
}) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [clvEmail, setClvEmail] = useState("");
  const [clvResult, setClvResult] = useState<ClvResult | null>(null);
  const [clvLoading, setClvLoading] = useState(false);
  const [showSegmentForm, setShowSegmentForm] = useState(false);
  const [segForm, setSegForm] = useState({ name: "", rule_type: "manual", description: "" });
  const [bridge, setBridge] = useState<BridgeResponse>(emptyBridgeResponse);
  const [bridgeLoading, setBridgeLoading] = useState(true);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [nangoIntegrations, setNangoIntegrations] = useState<CrmNangoIntegration[]>([]);
  const [nangoConnections, setNangoConnections] = useState<CrmNangoConnection[]>([]);
  const [nangoLoading, setNangoLoading] = useState(true);
  const [nangoBusy, setNangoBusy] = useState<string | null>(null);
  const [nangoStatus, setNangoStatus] = useState<string | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState("");
  const [recordForm, setRecordForm] = useState({
    provider_config_key: "hubspot",
    connection_id: "",
    local_entity_type: "contact",
    local_record_id: "",
    local_record_label: "",
    external_record_id: "",
    sync_state: "pending",
    sync_mode: "automatic",
    last_direction: "bidirectional",
  });
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null);

  const fetchSegments = useCallback(async () => {
    const res = await fetch("/api/admin/segments");
    if (res.ok) {
      const { data } = await res.json();
      setSegments(data ?? []);
    }
  }, []);

  const fetchBridge = useCallback(async () => {
    setBridgeLoading(true);
    setBridgeError(null);
    try {
      const res = await fetch("/api/admin/crm/bridge");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { data?: Partial<BridgeResponse> };
      const payload = data.data ?? {};
      setBridge({
        connections: Array.isArray(payload.connections) ? payload.connections : [],
        records: Array.isArray(payload.records) ? payload.records : [],
        mappings: Array.isArray(payload.mappings) ? payload.mappings : [],
        supportedApps: Array.isArray(payload.supportedApps) ? payload.supportedApps : [],
      });
    } catch (err) {
      setBridgeError(err instanceof Error ? err.message : "Failed to load bridge data");
    } finally {
      setBridgeLoading(false);
    }
  }, []);

  const fetchNango = useCallback(async () => {
    setNangoLoading(true);
    try {
      const res = await fetch("/api/admin/crm/nango", { credentials: "include", cache: "no-store" });
      const body = await res.json().catch(() => ({})) as { data?: CrmNangoConnection[]; integrations?: CrmNangoIntegration[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Unable to load CRM connections");
      const integrations = body.integrations ?? [];
      setNangoIntegrations(integrations);
      setSelectedIntegration((current) => current && integrations.some((item) => item.id === current) ? current : integrations[0]?.id ?? "");
      setNangoConnections(body.data ?? []);
      setNangoStatus(null);
    } catch (error) {
      setNangoStatus(error instanceof Error ? error.message : "Unable to load CRM connections");
    } finally {
      setNangoLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSegments();
    void fetchBridge();
    void fetchNango();
  }, [fetchBridge, fetchNango, fetchSegments]);

  async function handleClvLookup() {
    if (!clvEmail.trim()) return;
    setClvLoading(true);
    const res = await fetch(`/api/admin/analytics/clv?email=${encodeURIComponent(clvEmail)}`);
    if (res.ok) {
      const { data } = await res.json();
      setClvResult(data);
    } else {
      setClvResult(null);
    }
    setClvLoading(false);
  }

  async function handleCreateSegment(e: FormEvent) {
    e.preventDefault();
    setMutationError(null);
    setMutating(true);
    try {
      const res = await fetch("/api/admin/segments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(segForm),
      });
      if (!res.ok) throw new Error(`Unable to create segment (HTTP ${res.status})`);
      setShowSegmentForm(false);
      setSegForm({ name: "", rule_type: "manual", description: "" });
      await fetchSegments();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Unable to create segment");
    } finally {
      setMutating(false);
    }
  }

  async function postBridge(kind: "connection" | "record", payload: Record<string, unknown>) {
    const res = await fetch("/api/admin/crm/bridge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ kind, ...payload }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    await fetchBridge();
  }

  function openNangoSession(sessionToken: string, integrationId: string) {
    const nango = new Nango({ connectSessionToken: sessionToken });
    nango.openConnectUI({
      sessionToken,
      onEvent: async (event) => {
        if (event.type === "close") setNangoBusy(null);
        if (event.type !== "connect") return;
        const payload = event.payload as { connectionId?: unknown; providerConfigKey?: unknown } | undefined;
        const connectionId = typeof payload?.connectionId === "string" ? payload.connectionId : "";
        const providerConfigKey = typeof payload?.providerConfigKey === "string" ? payload.providerConfigKey : integrationId;
        if (!connectionId) {
          setNangoStatus("Nango completed authorization without a connection reference.");
          setNangoBusy(null);
          return;
        }
        try {
          const response = await fetch("/api/admin/crm/nango", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
            credentials: "include",
            body: JSON.stringify({ provider_config_key: providerConfigKey, connection_id: connectionId }),
          });
          const body = await response.json().catch(() => ({})) as { error?: string };
          if (!response.ok) throw new Error(body.error ?? "Unable to save CRM connection");
          setNangoStatus(`${integrationId} connected through Nango.`);
          await Promise.all([fetchNango(), fetchBridge()]);
        } catch (error) {
          setNangoStatus(error instanceof Error ? error.message : "Unable to save CRM connection");
        } finally {
          setNangoBusy(null);
        }
      },
    });
  }

  async function connectNango() {
    if (!selectedIntegration) return;
    setNangoBusy(selectedIntegration);
    setNangoStatus(null);
    try {
      const response = await fetch("/api/admin/crm/nango/connect-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        credentials: "include",
        body: JSON.stringify({ integration_id: selectedIntegration }),
      });
      const body = await response.json() as { data?: { session_token?: string }; error?: string };
      if (!response.ok || !body.data?.session_token) throw new Error(body.error ?? "Unable to start secure CRM connection");
      openNangoSession(body.data.session_token, selectedIntegration);
    } catch (error) {
      setNangoStatus(error instanceof Error ? error.message : "Unable to start secure CRM connection");
      setNangoBusy(null);
    }
  }

  async function disconnectNango(connection: CrmNangoConnection) {
    if (!window.confirm(`Disconnect ${connection.provider_config_key}? CRM sync for this account will stop.`)) return;
    setNangoBusy(connection.provider_config_key);
    try {
      const response = await fetch("/api/admin/crm/nango", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        credentials: "include",
        body: JSON.stringify({ provider_config_key: connection.provider_config_key, nango_connection_id: connection.nango_connection_id }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to disconnect CRM provider");
      setNangoStatus(`${connection.provider_config_key} disconnected.`);
      await Promise.all([fetchNango(), fetchBridge()]);
    } catch (error) {
      setNangoStatus(error instanceof Error ? error.message : "Unable to disconnect CRM provider");
    } finally {
      setNangoBusy(null);
    }
  }

  async function handleRecordSync(e: FormEvent) {
    e.preventDefault();
    setMutationError(null);
    setMutating(true);
    try {
      await postBridge("record", recordForm);
      setRecordForm((current) => ({
        ...current,
        connection_id: "",
        local_record_id: "",
        local_record_label: "",
        external_record_id: "",
      }));
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Unable to save CRM sync row");
    } finally {
      setMutating(false);
    }
  }

  const panelTitles: Record<ActivePanel, string> = {
    segments: "Customer segments",
    clv: "Customer lifetime value",
    connection: "Connect account",
    record: "Synced person or deal",
    connected: "Connected accounts",
    records: "Synced people and deals",
    mappings: "Customer mappings",
    catalog: "Integration catalog",
    roster: "Customer roster",
  };

  const actionGroups = [
    {
      label: "Customer insights",
      actions: [
        ["segments", "Customer segments"],
        ["clv", "Customer lifetime value"],
        ["roster", "Customer roster"],
      ] as [ActivePanel, string][],
    },
    {
      label: "Connections",
      actions: [
        ["connection", "Integrations"],
      ] as [ActivePanel, string][],
    },
    {
      label: "Sync health",
      actions: [
        ["record", "Synced person or deal"],
        ["records", "Synced people and deals"],
        ["mappings", "Customer mappings"],
      ] as [ActivePanel, string][],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4 shadow-xs ring-1 ring-foreground/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">CRM workspace controls</p>
            <p className="mt-1 text-xs text-muted-foreground">Customer insights, Nango connections, and sync health in one workspace.</p>
          </div>
          <Button type="button" onClick={() => setActivePanel("segments")}>Open CRM controls</Button>
        </div>
      </div>

      <Dialog open={activePanel !== null} onOpenChange={(open) => !open && setActivePanel(null)}>
        <DialogContent className="max-h-[min(88dvh,760px)] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
          <DialogTitle>CRM controls</DialogTitle>
            <DialogDescription>
              This action uses the tenant-scoped CRM API and persists changes to the workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 border-b pb-3">
            {actionGroups.map((group) => <Button key={group.label} type="button" size="sm" variant={group.actions.some(([panel]) => panel === activePanel) ? "default" : "outline"} onClick={() => setActivePanel(group.actions[0][0])}>{group.label}</Button>)}
          </div>
          <div id="crm-integrations" className="scroll-mt-6 space-y-6">
      {mutationError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="status" aria-live="polite">
          {mutationError}
        </p>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={activePanel === "segments" ? "rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6" : "hidden"}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Customer segments
            </h3>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowSegmentForm(true)}>
              Add segment
            </Button>
          </div>
          {segments.length === 0 ? (
            <p className="mt-4 text-sm text-on-surface-variant">No segments configured.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {segments.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded bg-surface-container-low px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-[10px] uppercase text-on-surface-variant">{s.rule_type}</p>
                  </div>
                  <span className="text-xs font-bold">{s.member_count} members</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={activePanel === "clv" ? "rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6" : "hidden"}>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Customer lifetime value
          </h3>
          <div className="mb-4 flex gap-2">
            <input
              type="email"
              autoComplete="email"
              placeholder="Customer email"
              value={clvEmail}
              onChange={(e) => setClvEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleClvLookup()}
              className="flex-1 rounded border border-outline-variant/20 px-3 py-2 text-sm focus:ring-1 focus:ring-primary/40"
            />
            <Button
              type="button"
              onClick={handleClvLookup}
              disabled={clvLoading}
            >
              {clvLoading ? "..." : "Lookup"}
            </Button>
          </div>
          {clvResult ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded bg-surface-container-low p-3">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                  Total spent
                </p>
                <p className="text-lg font-bold">
                  PHP{" "}
                  {(clvResult.total_spent / 100).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="rounded bg-surface-container-low p-3">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                  Orders
                </p>
                <p className="text-lg font-bold">{clvResult.order_count}</p>
              </div>
              <div className="col-span-2 rounded bg-surface-container-low p-3">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                  Avg order value
                </p>
                <p className="text-lg font-bold">
                  PHP{" "}
                  {(clvResult.avg_order_value / 100).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">Search by email to view customer value.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className={(activePanel === "connection" || activePanel === "connected" || activePanel === "catalog") ? "rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6" : "hidden"}>
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Nango CRM connections</h3><p className="mt-1 text-sm text-muted-foreground">Connect, inspect, and disconnect accounts from one tenant-scoped surface.</p></div>
            <Button type="button" variant="ghost" size="sm" onClick={() => void Promise.all([fetchNango(), fetchBridge()])} disabled={nangoLoading || nangoBusy !== null}>Refresh</Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2"><select aria-label="CRM integration" value={selectedIntegration} onChange={(event) => setSelectedIntegration(event.target.value)} disabled={nangoBusy !== null || nangoIntegrations.length === 0} className="h-9 rounded-lg border border-input bg-background px-2 text-sm"><option value="">{nangoIntegrations.length ? "Select CRM" : "No Nango CRM integrations configured"}</option>{nangoIntegrations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><Button type="button" onClick={() => void connectNango()} disabled={!selectedIntegration || nangoBusy !== null}>{nangoBusy === selectedIntegration ? "Starting..." : "Connect with Nango"}</Button></div>
          {nangoStatus ? <p role="status" aria-live="polite" className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{nangoStatus}</p> : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {nangoIntegrations.map((item) => { const connection = nangoConnections.find((row) => row.provider_config_key === item.id); return <div key={item.id} className="rounded-lg border bg-background p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-medium">{item.label}</p><p className="mt-1 text-xs text-muted-foreground">{item.description}</p></div><span className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.category}</span></div><div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{connection?.status === "connected" ? "Connected" : connection?.error ?? "Not connected"}</span>{connection ? <Button type="button" size="sm" variant="outline" onClick={() => void disconnectNango(connection)} disabled={nangoBusy !== null}>{nangoBusy === connection.provider_config_key ? "Working..." : "Disconnect"}</Button> : null}</div></div>; })}
          </div>
          {!nangoLoading && nangoIntegrations.length === 0 ? <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">Set <code>NANGO_API_KEY</code> and <code>NANGO_CRM_INTEGRATIONS</code> to enable CRM OAuth. Credentials never enter this admin.</p> : null}
        </div>

        <form
          onSubmit={handleRecordSync}
          className={activePanel === "record" ? "rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6" : "hidden"}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Synced person or deal
            </h3>
            <span className="text-[11px] uppercase tracking-widest text-on-surface-variant">
              Contact or deal row
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              required
              aria-label="CRM provider"
              placeholder="CRM provider"
              value={recordForm.provider_config_key}
              onChange={(e) =>
                setRecordForm((current) => ({ ...current, provider_config_key: e.target.value }))
              }
              className="rounded border border-outline-variant/20 px-3 py-2 text-sm"
            />
            <input
              required
              aria-label="Connected account reference"
              placeholder="Connected account reference"
              value={recordForm.connection_id}
              onChange={(e) =>
                setRecordForm((current) => ({ ...current, connection_id: e.target.value }))
              }
              className="rounded border border-outline-variant/20 px-3 py-2 text-sm"
            />
            <select
              aria-label="Record type"
              value={recordForm.local_entity_type}
              onChange={(e) =>
                setRecordForm((current) => ({ ...current, local_entity_type: e.target.value }))
              }
              className="rounded border border-outline-variant/20 px-3 py-2 text-sm"
            >
              <option value="contact">Contact</option>
              <option value="deal">Deal</option>
            </select>
            <input
              required
              aria-label="Customer or opportunity reference"
              placeholder="Customer or opportunity reference"
              value={recordForm.local_record_id}
              onChange={(e) =>
                setRecordForm((current) => ({ ...current, local_record_id: e.target.value }))
              }
              className="rounded border border-outline-variant/20 px-3 py-2 text-sm"
            />
            <input
              placeholder="Display label"
              aria-label="Display label"
              value={recordForm.local_record_label}
              onChange={(e) =>
                setRecordForm((current) => ({ ...current, local_record_label: e.target.value }))
              }
              className="rounded border border-outline-variant/20 px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              placeholder="Connected account reference"
              aria-label="External record reference"
              value={recordForm.external_record_id}
              onChange={(e) =>
                setRecordForm((current) => ({ ...current, external_record_id: e.target.value }))
              }
              className="rounded border border-outline-variant/20 px-3 py-2 text-sm"
            />
            <select
              aria-label="Sync state"
              value={recordForm.sync_state}
              onChange={(e) =>
                setRecordForm((current) => ({ ...current, sync_state: e.target.value }))
              }
              className="rounded border border-outline-variant/20 px-3 py-2 text-sm"
            >
              <option value="pending">Pending</option>
              <option value="synced">Synced</option>
              <option value="partial">Needs attention</option>
              <option value="failed">Failed</option>
              <option value="manual_only">Manual only</option>
              <option value="disabled">Disabled</option>
              <option value="stale">Stale</option>
            </select>
            <select
              aria-label="Sync mode"
              value={recordForm.sync_mode}
              onChange={(e) =>
                setRecordForm((current) => ({ ...current, sync_mode: e.target.value }))
              }
              className="rounded border border-outline-variant/20 px-3 py-2 text-sm"
            >
              <option value="automatic">Automatic</option>
              <option value="manual">Manual</option>
              <option value="disabled">Disabled</option>
            </select>
            <select
              aria-label="Last sync direction"
              value={recordForm.last_direction}
              onChange={(e) =>
                setRecordForm((current) => ({ ...current, last_direction: e.target.value }))
              }
              className="rounded border border-outline-variant/20 px-3 py-2 text-sm"
            >
              <option value="bidirectional">Bidirectional</option>
              <option value="to_crm">To CRM</option>
              <option value="from_crm">From CRM</option>
            </select>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={mutating}>
              {mutating ? "Saving..." : "Save row"}
            </Button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className={activePanel === "connected" ? "rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6" : "hidden"}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Connected accounts
            </h3>
            <Button type="button" variant="ghost" size="sm" onClick={() => void fetchBridge()}>
              Refresh
            </Button>
          </div>
          {bridgeLoading ? (
            <p className="mt-4 text-sm text-on-surface-variant">Loading bridge data...</p>
          ) : bridgeError ? (
            <p className="mt-4 text-sm text-red-700">{bridgeError}</p>
          ) : bridge.connections.length === 0 ? (
            <p className="mt-4 text-sm text-on-surface-variant">No accounts connected yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {bridge.connections.map((connection) => (
                <div
                  key={connection.id}
                  className="rounded border border-outline-variant/15 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-primary">{connection.connection_name ?? connection.connection_id}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {connection.sync_scope === "global" ? "All store locations" : connection.sync_scope}
                      </p>
                    </div>
                    <span className="text-xs text-on-surface-variant">
                      {connection.active ? "Active" : "Paused"}
                    </span>
                  </div>
                    <p className="mt-2 text-xs text-on-surface-variant">
                    {connection.staff_email ?? "No team contact"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={activePanel === "records" ? "rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6" : "hidden"}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Synced people and deals
            </h3>
            <span className="text-xs text-on-surface-variant">
              {bridge.records.length} rows
            </span>
          </div>
          {bridge.records.length === 0 ? (
            <p className="mt-4 text-sm text-on-surface-variant">No synced rows yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {bridge.records.slice(0, 8).map((record) => (
                <div key={record.id} className="rounded border border-outline-variant/15 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-primary">
                        {record.local_record_label ?? record.local_record_id}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {record.local_entity_type === "contact" ? "Customer" : "Opportunity"}
                      </p>
                    </div>
                    <span className="text-xs text-on-surface-variant">{record.sync_state}</span>
                  </div>
                  <p className="mt-2 text-xs text-on-surface-variant">
                    Connected reference {record.external_record_id ?? "—"} · {record.sync_mode === "automatic" ? "Automatic updates" : "Manual updates"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className={activePanel === "mappings" ? "rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6" : "hidden"}>
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Customer mappings
          </h3>
          {bridge.mappings.length === 0 ? (
            <p className="mt-4 text-sm text-on-surface-variant">No mapping rows yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {bridge.mappings.slice(0, 8).map((mapping) => (
                <div key={mapping.id} className="rounded border border-outline-variant/15 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-primary">{mapping.customer_email}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                    Store customer {mapping.medusa_customer_id ?? "—"}
                      </p>
                    </div>
                    <span className="text-xs text-on-surface-variant">{mapping.sync_state}</span>
                  </div>
                  <p className="mt-2 text-xs text-on-surface-variant">
                    Connected customer {mapping.external_contact_id ?? "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <div className={activePanel === "catalog" ? "rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6" : "hidden"}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Integration catalog
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Supported CRM, sales, support, marketing, and messaging targets.
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0 tabular-nums">
            {supportedApps.length}
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {supportedApps.map((app) => (
            <div key={app.provider_config_key} className="rounded-lg border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="truncate text-sm font-medium">{app.label}</p>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {app.category}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {app.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className={activePanel === "roster" ? "rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6" : "hidden"}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Customer roster
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {customers.length} customers, {registeredCount} registered accounts.
            </p>
          </div>
          <Badge variant="outline">Tenant scoped</Badge>
        </div>
        <CrmCustomerRoster customers={customers} />
      </div>

          </div>
        </DialogContent>
      </Dialog>

      {showSegmentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleCreateSegment}
            className="w-full max-w-sm space-y-5 rounded-xl bg-white p-8 shadow-2xl"
          >
            <h2 className="text-lg font-bold font-headline">Create segment</h2>
            <input
              required
              placeholder="Segment name"
              value={segForm.name}
              onChange={(e) => setSegForm({ ...segForm, name: e.target.value })}
              className="w-full rounded border border-outline-variant/20 px-3 py-2.5 text-sm"
            />
            <select
              value={segForm.rule_type}
              onChange={(e) => setSegForm({ ...segForm, rule_type: e.target.value })}
              className="w-full rounded border border-outline-variant/20 px-3 py-2.5 text-sm"
            >
              <option value="manual">Manual</option>
              <option value="spend_above">Spend Above Threshold</option>
              <option value="spend_below">Spend Below Threshold</option>
              <option value="order_count_above">Order Count Above</option>
              <option value="inactive_days">Inactive Days</option>
              <option value="tier">Loyalty Tier</option>
            </select>
            <textarea
              placeholder="Description"
              value={segForm.description}
              onChange={(e) => setSegForm({ ...segForm, description: e.target.value })}
              className="h-24 w-full rounded border border-outline-variant/20 px-3 py-2.5 text-sm"
            />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowSegmentForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutating}>
                {mutating ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
