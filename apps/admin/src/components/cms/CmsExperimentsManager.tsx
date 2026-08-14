"use client";

import { useSession } from "next-auth/react";
import { staffHasPermission } from "@universal-music-store/platform-data";
import { useCallback, useEffect, useMemo, useState } from "react";

type VariantRow = { id: string; weight: string };

type ExpRow = {
  id: string;
  experiment_key: string;
  name: string;
  variants: unknown;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  traffic_cap_pct: number | null;
  target_page_slug: string | null;
  target_component_key: string | null;
  impressions: number;
  conversions: number;
};

function parseVariants(v: unknown): VariantRow[] {
  if (!Array.isArray(v))
    return [
      { id: "a", weight: "0.5" },
      { id: "b", weight: "0.5" },
    ];
  return v.map((x) => {
    const o = x as Record<string, unknown>;
    return {
      id: String(o.id ?? "variant"),
      weight: String(
        typeof o.weight === "number" ? o.weight : (o.weight ?? "0"),
      ),
    };
  });
}

export function CmsExperimentsManager() {
  const { data: session, status } = useSession();
  const canWrite = staffHasPermission(
    session?.user?.permissions ?? [],
    "content:write",
  );
  const [rows, setRows] = useState<ExpRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [trafficCap, setTrafficCap] = useState("");
  const [targetSlug, setTargetSlug] = useState("");
  const [targetComponent, setTargetComponent] = useState("");
  const [variants, setVariants] = useState<VariantRow[]>([
    { id: "a", weight: "0.5" },
    { id: "b", weight: "0.5" },
  ]);

  const weightSum = useMemo(() => {
    return variants.reduce((s, v) => s + (Number.parseFloat(v.weight) || 0), 0);
  }, [variants]);
  const weightOk = Math.abs(weightSum - 1) < 0.02;

  const load = useCallback(() => {
    setLoadingRows(true);
    setError(null);
    fetch("/api/admin/cms/experiments")
      .then(async (r) => {
        const j = (await r.json()) as { data?: ExpRow[]; error?: string };
        if (!r.ok) throw new Error(j.error ?? r.statusText);
        return j.data ?? [];
      })
      .then(setRows)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Unable to load content"),
      )
      .finally(() => setLoadingRows(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetNew = () => {
    setEditingId(null);
    setKey("");
    setName("");
    setActive(true);
    setStartsAt("");
    setEndsAt("");
    setTrafficCap("");
    setTargetSlug("");
    setTargetComponent("");
    setVariants([
      { id: "a", weight: "0.5" },
      { id: "b", weight: "0.5" },
    ]);
  };

  const loadOne = (r: ExpRow) => {
    setEditingId(r.id);
    setKey(r.experiment_key);
    setName(r.name);
    setActive(r.active);
    setStartsAt(r.starts_at ?? "");
    setEndsAt(r.ends_at ?? "");
    setTrafficCap(r.traffic_cap_pct != null ? String(r.traffic_cap_pct) : "");
    setTargetSlug(r.target_page_slug ?? "");
    setTargetComponent(r.target_component_key ?? "");
    setVariants(parseVariants(r.variants));
  };

  const save = async () => {
    if (!canWrite) return;
    if (!key.trim() || !name.trim()) {
      setError("Experiment key and name are required.");
      return;
    }
    if (!weightOk) {
      setError("Variant weights must sum to 1 (within 0.02).");
      return;
    }
    setError(null);
    const payload = {
      id: editingId ?? undefined,
      experiment_key: key.trim(),
      name: name.trim(),
      active,
      starts_at: startsAt.trim() || null,
      ends_at: endsAt.trim() || null,
      traffic_cap_pct:
        trafficCap.trim() === ""
          ? null
          : Number.isFinite(Number(trafficCap))
            ? Number(trafficCap)
            : null,
      target_page_slug: targetSlug.trim() || null,
      target_component_key: targetComponent.trim() || null,
      variants: variants.map((v) => ({
        id: v.id.trim(),
        weight: Number.parseFloat(v.weight) || 0,
      })),
    };
    const r = await fetch("/api/admin/cms/experiments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = (await r.json()) as { error?: string };
    if (!r.ok) {
      setError(j.error ?? "Failed");
      return;
    }
    resetNew();
    load();
  };

  if (status === "loading")
    return <p className="text-sm text-slate-600">Loading…</p>;

  return (
    <div className="space-y-8 max-w-3xl">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-700">
        <p className="font-semibold text-slate-900">Guardrails</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            Treat sample sizes below a few hundred impressions per variant as
            noisy. Compare conversion rates only after enough traffic.
          </li>
          <li>
            Run at most one active experiment per surface (page or component) so
            assignments stay interpretable.
          </li>
        </ul>
        <p className="mt-3">
          Storefront integration: read{" "}
          <code className="rounded bg-white px-1">
            docs/cms-experiment-storefront-keys.md
          </code>{" "}
          in the repo root.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-medium text-slate-800">
          {editingId ? "Edit experiment" : "Create experiment"}
        </p>
        <input
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="experiment_key"
        />
        <input
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Active
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-600">
            Starts (ISO)
            <input
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1 font-mono text-sm"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600">
            Ends (ISO)
            <input
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1 font-mono text-sm"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </label>
        </div>
        <label className="text-xs text-slate-600">
          Traffic cap % (0–100, optional)
          <input
            className="mt-1 w-full max-w-xs rounded border border-slate-200 px-2 py-1 text-sm"
            value={trafficCap}
            onChange={(e) => setTrafficCap(e.target.value)}
            placeholder="e.g. 50"
          />
        </label>
        <label className="text-xs text-slate-600">
          Target CMS page slug (optional)
          <input
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
            value={targetSlug}
            onChange={(e) => setTargetSlug(e.target.value)}
          />
        </label>
        <label className="text-xs text-slate-600">
          Target component key (optional)
          <input
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
            value={targetComponent}
            onChange={(e) => setTargetComponent(e.target.value)}
            placeholder="e.g. hero_primary_cta"
          />
        </label>

        <div>
          <p className="text-xs font-medium text-slate-700">
            Variants (weights must sum to 1)
          </p>
          <ul className="mt-2 space-y-2">
            {variants.map((v, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <input
                  className="w-32 rounded border border-slate-200 px-2 py-1 text-sm"
                  value={v.id}
                  onChange={(e) => {
                    const n = [...variants];
                    n[i] = { ...n[i], id: e.target.value };
                    setVariants(n);
                  }}
                  placeholder="id"
                />
                <input
                  className="w-24 rounded border border-slate-200 px-2 py-1 text-sm font-mono"
                  value={v.weight}
                  onChange={(e) => {
                    const n = [...variants];
                    n[i] = { ...n[i], weight: e.target.value };
                    setVariants(n);
                  }}
                  placeholder="0.5"
                />
                <button
                  type="button"
                  className="text-xs text-red-700 underline"
                  onClick={() =>
                    setVariants(variants.filter((_, j) => j !== i))
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-2 text-xs text-primary underline"
            onClick={() =>
              setVariants([
                ...variants,
                { id: `v${variants.length + 1}`, weight: "0" },
              ])
            }
          >
            Add variant
          </button>
          <p
            className={`mt-2 text-xs ${weightOk ? "text-emerald-800" : "text-amber-800"}`}
          >
            Sum of weights: {weightSum.toFixed(4)}{" "}
            {weightOk ? "(ok)" : "(adjust to 1.0)"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canWrite}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
            onClick={() => void save()}
          >
            Save
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
            onClick={resetNew}
          >
            New
          </button>
        </div>
      </div>

      {loadingRows ? (
        <p className="text-sm text-slate-600">Loading experiments...</p>
      ) : null}
      {!loadingRows && rows.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No experiments have been created.
        </p>
      ) : null}
      <ul className="space-y-2 text-sm" aria-label="CMS experiments">
        {rows.map((r) => (
          <li key={r.id} className="rounded border border-slate-200 px-3 py-2">
            <button
              type="button"
              className="text-left font-medium text-primary underline"
              onClick={() => loadOne(r)}
            >
              {r.experiment_key}
            </button>{" "}
            — {r.name}{" "}
            <span className="text-slate-500">
              {r.active ? "(active)" : "(inactive)"}
            </span>
            <span className="ml-2 text-xs text-slate-500">
              imp {r.impressions} / conv {r.conversions}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
