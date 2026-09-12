"use client";

import { staffHasPermission, type PlatformRuntimeSettings, RUNTIME_PAYMENT_PROVIDERS } from "@universal-music-store/platform-data";
import { useSession } from "@/lib/auth-client";
import { useEffect, useState } from "react";

const inputClass = "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800";
const labelClass = "block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5";

function NumberField({ id, label, value, onChange, disabled }: { id: string; label: string; value: number; onChange: (value: number) => void; disabled: boolean }) {
  return <div><label className={labelClass} htmlFor={id}>{label}</label><input id={id} className={inputClass} type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} disabled={disabled} /></div>;
}

export function PlatformRuntimeSettingsEditor() {
  const { data: session } = useSession();
  const canWrite = staffHasPermission(session?.user?.permissions ?? [], "settings:write");
  const [settings, setSettings] = useState<PlatformRuntimeSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/runtime-settings", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as { data?: PlatformRuntimeSettings; error?: string };
        if (!response.ok || !body.data) throw new Error(body.error ?? response.statusText);
        if (!cancelled) setSettings(body.data);
      })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load settings"); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <p className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p>;
  if (!settings) return <p className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading runtime settings…</p>;

  const update = (patch: Partial<PlatformRuntimeSettings>) => setSettings((current) => current ? { ...current, ...patch } : current);
  const updateLimits = (key: keyof PlatformRuntimeSettings["rateLimits"], value: number) => setSettings((current) => current ? { ...current, rateLimits: { ...current.rateLimits, [key]: value } } : current);
  const updateFlags = (key: keyof PlatformRuntimeSettings["featureFlags"], value: boolean) => setSettings((current) => current ? { ...current, featureFlags: { ...current.featureFlags, [key]: value } } : current);
  const updatePickup = (key: keyof PlatformRuntimeSettings["pickup"], value: string) => setSettings((current) => current ? { ...current, pickup: { ...current.pickup, [key]: value } } : current);
  const updateLink = (key: keyof PlatformRuntimeSettings["policyLinks"], value: string) => setSettings((current) => current ? { ...current, policyLinks: { ...current.policyLinks, [key]: value } } : current);
  const toggleProvider = (provider: (typeof RUNTIME_PAYMENT_PROVIDERS)[number]) => setSettings((current) => current ? { ...current, enabledPaymentProviders: current.enabledPaymentProviders.includes(provider) ? current.enabledPaymentProviders.filter((item) => item !== provider) : [...current.enabledPaymentProviders, provider] } : current);

  const save = async () => {
    if (!canWrite) return;
    setSaving(true); setSaved(false); setError(null);
    try {
      const response = await fetch("/api/admin/runtime-settings", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const body = (await response.json()) as { data?: PlatformRuntimeSettings; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error ?? response.statusText);
      setSettings(body.data); setSaved(true);
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Unable to save settings"); }
    finally { setSaving(false); }
  };

  return <section className="max-w-4xl space-y-8 rounded border border-slate-200 bg-white p-6 shadow-sm">
    <div><h2 className="font-headline text-lg font-bold text-slate-900">Store runtime settings</h2><p className="mt-2 text-sm text-slate-600">Organization-scoped operational defaults. Secrets and provider credentials stay in deployment environment variables.</p></div>
    <div className="grid gap-6 md:grid-cols-2">
      <div><label className={labelClass} htmlFor="runtime-store-name">Store name</label><input id="runtime-store-name" className={inputClass} value={settings.storeName} onChange={(e) => update({ storeName: e.target.value })} disabled={!canWrite} /></div>
      <div><label className={labelClass} htmlFor="runtime-support-email">Support email</label><input id="runtime-support-email" type="email" className={inputClass} value={settings.supportEmail} onChange={(e) => update({ supportEmail: e.target.value })} disabled={!canWrite} /></div>
      <div><label className={labelClass} htmlFor="runtime-locale">CMS locale</label><input id="runtime-locale" className={inputClass} value={settings.cmsLocale} onChange={(e) => update({ cmsLocale: e.target.value })} disabled={!canWrite} /></div>
      <div><label className={labelClass} htmlFor="runtime-country">Merchant country</label><input id="runtime-country" className={inputClass} maxLength={3} value={settings.merchantCountry} onChange={(e) => update({ merchantCountry: e.target.value.toUpperCase() })} disabled={!canWrite} /></div>
      <label className="flex items-center gap-3 text-sm text-slate-800 md:col-span-2"><input type="checkbox" checked={settings.maintenanceMode} onChange={(e) => update({ maintenanceMode: e.target.checked })} disabled={!canWrite} /> Maintenance mode</label>
    </div>
    <fieldset><legend className="text-xs font-bold uppercase tracking-widest text-slate-500">Payment methods</legend><div className="mt-3 flex flex-wrap gap-4">{RUNTIME_PAYMENT_PROVIDERS.map((provider) => <label key={provider} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.enabledPaymentProviders.includes(provider)} onChange={() => toggleProvider(provider)} disabled={!canWrite} />{provider}</label>)}</div></fieldset>
    <fieldset><legend className="text-xs font-bold uppercase tracking-widest text-slate-500">Feature flags</legend><div className="mt-3 flex flex-wrap gap-4">{(["stripe", "paypal", "xendit", "pancakePos", "loyalty", "reviews", "experiments"] as const).map((key) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.featureFlags[key]} onChange={(e) => updateFlags(key, e.target.checked)} disabled={!canWrite} />{key}</label>)}</div></fieldset>
    <fieldset><legend className="text-xs font-bold uppercase tracking-widest text-slate-500">Policy links</legend><div className="mt-3 grid gap-6 md:grid-cols-2">{(["shipping", "returns", "terms", "privacy", "cookies", "accessibility", "warrantyPdf"] as const).map((key) => <div key={key}><label className={labelClass} htmlFor={`runtime-policy-${key}`}>{key}</label><input id={`runtime-policy-${key}`} className={inputClass} value={settings.policyLinks[key]} onChange={(e) => updateLink(key, e.target.value)} disabled={!canWrite} placeholder={key === "warrantyPdf" ? "https://… or leave blank" : `/${key}`} /></div>)}</div></fieldset>
    <fieldset><legend className="text-xs font-bold uppercase tracking-widest text-slate-500">Operational controls</legend><div className="mt-3 grid gap-6 md:grid-cols-2"><NumberField id="runtime-retention" label="Retention days" value={settings.retentionDays} onChange={(value) => update({ retentionDays: value })} disabled={!canWrite} /><NumberField id="runtime-low-stock" label="Low-stock threshold" value={settings.lowStockThreshold} onChange={(value) => update({ lowStockThreshold: value })} disabled={!canWrite} /><NumberField id="runtime-checkout-limit" label="Checkout intents / minute" value={settings.rateLimits.checkoutIntentPerMinute} onChange={(value) => updateLimits("checkoutIntentPerMinute", value)} disabled={!canWrite} /><NumberField id="runtime-track-limit" label="Public tracking / minute" value={settings.rateLimits.publicTrackPerMinute} onChange={(value) => updateLimits("publicTrackPerMinute", value)} disabled={!canWrite} /></div></fieldset>
    <fieldset><legend className="text-xs font-bold uppercase tracking-widest text-slate-500">Pancake pickup location</legend><div className="mt-3 grid gap-6 md:grid-cols-2">{(["name", "phone", "province", "city", "area", "address"] as const).map((key) => <div key={key}><label className={labelClass} htmlFor={`runtime-pickup-${key}`}>{key}</label><input id={`runtime-pickup-${key}`} className={inputClass} value={settings.pickup[key]} onChange={(e) => updatePickup(key, e.target.value)} disabled={!canWrite} /></div>)}</div></fieldset>
    {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
    <div className="flex items-center gap-3"><button type="button" onClick={() => void save()} disabled={!canWrite || saving} className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save settings"}</button>{saved ? <span className="text-sm text-emerald-700" role="status">Saved for this organization.</span> : null}</div>
  </section>;
}
