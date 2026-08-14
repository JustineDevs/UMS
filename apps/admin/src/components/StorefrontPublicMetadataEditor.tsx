"use client";

import {
  EMPTY_STOREFRONT_PUBLIC_METADATA,
  type StorefrontPublicMetadataPayload,
  staffHasPermission,
} from "@universal-music-store/platform-data";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

function labelClass() {
  return "block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5";
}

function inputClass() {
  return "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-primary/30";
}

export function StorefrontPublicMetadataEditor() {
  const { data: session, status } = useSession();
  const [payload, setPayload] = useState<StorefrontPublicMetadataPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const [saving, setSaving] = useState(false);

  const canWrite = staffHasPermission(session?.user?.permissions ?? [], "settings:write");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/storefront-public-metadata")
      .then(async (r) => {
        const j = (await r.json()) as {
          data?: StorefrontPublicMetadataPayload;
          error?: string;
        };
        if (!r.ok) throw new Error(j.error ?? r.statusText);
        return j.data;
      })
      .then((data) => {
        if (!cancelled && data) setPayload(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Unable to load");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<StorefrontPublicMetadataPayload>) => {
    setPayload((p) =>
      p ? { ...p, ...patch } : { ...EMPTY_STOREFRONT_PUBLIC_METADATA, ...patch },
    );
  }, []);

  const save = useCallback(async () => {
    if (!payload || !canWrite) return;
    setSaving(true);
    setSaveError(null);
    setSavedOk(false);
    try {
      const r = await fetch("/api/admin/storefront-public-metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await r.json()) as {
        data?: StorefrontPublicMetadataPayload;
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? r.statusText);
      if (j.data) setPayload(j.data);
      setSavedOk(true);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  }, [payload, canWrite]);

  if (status === "loading" || (payload === null && !loadError)) {
    return (
      <div className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Loading contact and social settings…
      </div>
    );
  }

  if (loadError || !payload) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {loadError ?? "Failed to load"}
      </div>
    );
  }

  return (
    <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-headline text-lg font-bold text-slate-900">Contact and social</h2>
      <p className="mt-2 max-w-prose text-sm text-slate-600">
        Values saved here appear on the live site (footer and contact page). Leave a field empty to
        use the default from your deployment settings when one exists.
      </p>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <label className={labelClass()} htmlFor="pub-instagram">
            Instagram URL or handle
          </label>
          <input
            id="pub-instagram"
            className={inputClass()}
            value={payload.instagramUrl}
            onChange={(e) => update({ instagramUrl: e.target.value })}
            placeholder="https://instagram.com/yourshop or @yourshop"
            disabled={!canWrite}
          />
        </div>
        {([
          ["facebookUrl", "Facebook URL", "https://facebook.com/yourshop"],
          ["tiktokUrl", "TikTok URL", "https://tiktok.com/@yourshop"],
          ["youtubeUrl", "YouTube URL", "https://youtube.com/@yourshop"],
          ["xUrl", "X URL", "https://x.com/yourshop"],
          ["linkedinUrl", "LinkedIn URL", "https://linkedin.com/company/yourshop"],
          ["whatsappUrl", "WhatsApp URL", "https://wa.me/639..."],
          ["messengerUrl", "Messenger URL", "https://m.me/yourshop"],
        ] as const).map(([key, label, placeholder]) => (
          <div key={key}>
            <label className={labelClass()} htmlFor={`pub-${key}`}>{label}</label>
            <input
              id={`pub-${key}`}
              className={inputClass()}
              value={payload[key]}
              onChange={(e) => update({ [key]: e.target.value })}
              placeholder={placeholder}
              disabled={!canWrite}
            />
          </div>
        ))}
        <div>
          <label className={labelClass()} htmlFor="pub-email">
            Support email
          </label>
          <input
            id="pub-email"
            type="email"
            className={inputClass()}
            value={payload.supportEmail}
            onChange={(e) => update({ supportEmail: e.target.value })}
            placeholder="support@example.com"
            disabled={!canWrite}
            autoComplete="off"
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass()} htmlFor="pub-phone">
            Support phone (display)
          </label>
          <input
            id="pub-phone"
            className={inputClass()}
            value={payload.supportPhone}
            onChange={(e) => update({ supportPhone: e.target.value })}
            placeholder="+63 …"
            disabled={!canWrite}
            autoComplete="off"
          />
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => void save()}
          disabled={!canWrite || saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {savedOk ? <span className="text-sm text-emerald-700">Saved.</span> : null}
        {saveError ? <span className="text-sm text-red-700">{saveError}</span> : null}
      </div>
    </section>
  );
}
