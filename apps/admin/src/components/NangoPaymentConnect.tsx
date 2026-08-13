"use client";

import { useEffect, useState } from "react";
import Nango from "@nangohq/frontend";
import { CheckCircle2, CircleAlert, Loader2, PlugZap, RefreshCw, Unplug } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PaymentNangoConnection, PaymentNangoIntegration } from "@/lib/payment-nango";

type ConnectionsResponse = {
  data?: PaymentNangoConnection[];
  integrations?: PaymentNangoIntegration[];
  source?: string;
  error?: string;
};

type CapabilityResponse = {
  data?: Array<{
    provider: string;
    implementedCapabilities: string[];
    unavailableInUvs: string[];
  }>;
};

type PaymentCapability = NonNullable<CapabilityResponse["data"]>[number];

export function NangoPaymentConnect() {
  const [integrations, setIntegrations] = useState<PaymentNangoIntegration[]>([]);
  const [integration, setIntegration] = useState("");
  const [connections, setConnections] = useState<PaymentNangoConnection[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [capabilities, setCapabilities] = useState<PaymentCapability[]>([]);

  async function loadConnections() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/payments/connections", { credentials: "include", cache: "no-store" });
      const body = await response.json().catch(() => ({})) as ConnectionsResponse;
      if (!response.ok) throw new Error(body.error ?? "Unable to load Nango connection status");
      const available = body.integrations ?? [];
      setIntegrations(available);
      setIntegration((current) => current && available.some((item) => item.id === current) ? current : (available[0]?.id ?? ""));
      setConnections(body.data ?? []);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConnections().catch((error) => setStatus(error instanceof Error ? error.message : "Unable to load connection status"));
    void fetch("/api/admin/payments/capabilities", { credentials: "include", cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as CapabilityResponse : { data: [] })
      .then((body) => setCapabilities(body.data ?? []))
      .catch(() => setCapabilities([]));
  }, []);

  function openConnectSession(sessionToken: string, integrationId: string, action: "connect" | "reconnect") {
    const nango = new Nango({ connectSessionToken: sessionToken });
    nango.openConnectUI({
      sessionToken,
      onEvent: async (event) => {
        if (event.type === "connect") {
          const payload = event.payload as { connectionId?: unknown; providerConfigKey?: unknown } | undefined;
          const connectionId = typeof payload?.connectionId === "string" ? payload.connectionId : "";
          const providerConfigKey = typeof payload?.providerConfigKey === "string" ? payload.providerConfigKey : integrationId;
          if (!connectionId) {
            setStatus("Nango completed authorization but did not return a connection reference.");
            setBusy(null);
            return;
          }
          setStatus(`${integrationId} ${action} completed. Verifying and saving the connection.`);
          try {
            const response = await fetch("/api/admin/payments/connections", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ connection_id: connectionId, provider_config_key: providerConfigKey }),
            });
            const body = await response.json().catch(() => ({})) as { error?: string };
            if (!response.ok) throw new Error(body.error ?? "Unable to save verified payment connection");
            await loadConnections();
            setStatus(`${integrationId} is connected and verified.`);
          } catch (error) {
            setStatus(error instanceof Error ? error.message : "Unable to save verified payment connection");
          } finally {
            setBusy(null);
          }
        }
        if (event.type === "close") setBusy(null);
      },
    });
  }

  async function createSession() {
    if (!integration) return;
    setBusy(integration);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/payments/connect-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ integration_id: integration }) });
      const body = await response.json() as { data?: { session_token?: string }; error?: string };
      if (!response.ok || !body.data?.session_token) throw new Error(body.error ?? "Unable to start secure connection");
      openConnectSession(body.data.session_token, integration, "connect");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to start secure connection");
      setBusy(null);
    }
  }

  async function reconnect(connection: PaymentNangoConnection) {
    setBusy(connection.provider_config_key);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/payments/connections/reconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider_config_key: connection.provider_config_key, nango_connection_id: connection.nango_connection_id }) });
      const body = await response.json() as { data?: { session_token?: string }; error?: string };
      if (!response.ok || !body.data?.session_token) throw new Error(body.error ?? "Unable to start reconnect");
      openConnectSession(body.data.session_token, connection.provider_config_key, "reconnect");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to start reconnect");
      setBusy(null);
    }
  }

  async function disconnect(connection: PaymentNangoConnection) {
    if (!window.confirm(`Disconnect ${connection.provider_config_key}? Existing payment processing will stop for this account.`)) return;
    setBusy(connection.provider_config_key);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/payments/connections", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider_config_key: connection.provider_config_key, nango_connection_id: connection.nango_connection_id }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to disconnect payment provider");
      setStatus(`${connection.provider_config_key} disconnected.`);
      await loadConnections();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to disconnect payment provider");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium"><PlugZap className="size-4 text-primary" />Merchant account connections</div>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">OAuth and Partner Connect only. Nango stores and refreshes provider credentials; this admin stores connection references, never secrets.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Payment integration" value={integration} onChange={(event) => setIntegration(event.target.value)} disabled={busy !== null || integrations.length === 0} className="h-8 rounded-lg border border-input bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
            {integrations.length === 0 ? <option value="">No Nango integrations configured</option> : integrations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <Button size="sm" onClick={() => void createSession()} disabled={!integration || busy !== null}><PlugZap />{busy === integration ? "Starting..." : "Connect securely"}</Button>
          <Button size="sm" variant="outline" onClick={() => void loadConnections()} disabled={busy !== null}><RefreshCw />Refresh</Button>
        </div>
      </div>
      {status ? <p role="status" className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{status}</p> : null}
      {!loading && !status && integrations.length === 0 ? <p role="status" className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">Payment connections are not configured on this server. Set <code>NANGO_API_KEY</code> and <code>NANGO_PAYMENT_INTEGRATIONS</code> before connecting a merchant account.</p> : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Payment provider connections">
        {integrations.map((item) => {
          const connection = connections.find((row) => row.provider_config_key === item.id);
          const pending = busy === item.id;
          return <div key={item.id} className="flex min-h-24 flex-col justify-between rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{item.label}</p><p className="mt-0.5 text-xs text-muted-foreground">{connection?.nango_connection_id ? `Connection ${connection.nango_connection_id}` : "No connection"}</p></div>{connection?.status === "connected" ? <CheckCircle2 className="size-4 text-emerald-600" aria-label="Connected" /> : connection ? <CircleAlert className="size-4 text-amber-600" aria-label="Needs attention" /> : <span className="text-xs text-muted-foreground">Not connected</span>}</div>
            {connection ? <div className="flex items-center justify-between gap-2"><span className={connection.status === "connected" ? "text-xs text-emerald-700 dark:text-emerald-300" : "text-xs text-amber-700 dark:text-amber-300"}>{connection.status === "connected" ? "Connected" : connection.error ?? "Needs attention"}</span><div className="flex gap-1"><Button size="icon-xs" variant="outline" onClick={() => void reconnect(connection)} disabled={busy !== null} aria-label={`Reconnect ${item.label}`}>{pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}</Button><Button size="icon-xs" variant="ghost" onClick={() => void disconnect(connection)} disabled={busy !== null} aria-label={`Disconnect ${item.label}`}><Unplug /></Button></div></div> : null}
          </div>;
        })}
      </div>
      {capabilities.length > 0 ? <div className="mt-4 rounded-lg border border-border/70 bg-muted/20 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Executable provider capabilities</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {capabilities.map((item) => <div key={item.provider} className="rounded-md border bg-background p-2">
            <p className="text-sm font-medium capitalize">{item.provider}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.implementedCapabilities.length} enabled operations</p>
            {item.unavailableInUvs.length > 0 ? <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">{item.unavailableInUvs.length} provider features require a dedicated UVS module</p> : null}
          </div>)}
        </div>
      </div> : null}
    </div>
  );
}
