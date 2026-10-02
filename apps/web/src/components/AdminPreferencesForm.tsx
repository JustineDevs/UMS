"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import {
  defaultAdminPreferences,
  readAdminPreferences,
  writeAdminPreferences,
  type AdminPreferences,
} from "@universal-music-store/user-preferences";

const serverAdminPreferences = defaultAdminPreferences();
let cachedAdminPreferences: AdminPreferences | null = null;

function getAdminPreferencesSnapshot() {
  const next = readAdminPreferences();
  if (
    cachedAdminPreferences &&
    cachedAdminPreferences.uiDensity === next.uiDensity &&
    cachedAdminPreferences.inventoryPageSize === next.inventoryPageSize &&
    cachedAdminPreferences.reduceMotion === next.reduceMotion
  ) {
    return cachedAdminPreferences;
  }
  cachedAdminPreferences = next;
  return next;
}

export function AdminPreferencesForm() {
  const prefs = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("admin-prefs-updated", onStoreChange);
      return () => window.removeEventListener("admin-prefs-updated", onStoreChange);
    },
    getAdminPreferencesSnapshot,
    () => serverAdminPreferences,
  );
  const [saved, setSaved] = useState(false);

  const update = useCallback((patch: Partial<AdminPreferences>) => {
    writeAdminPreferences(patch);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }, []);

  const reset = useCallback(() => {
    const defaults = defaultAdminPreferences();
    writeAdminPreferences(defaults);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }, []);

  return (
    <div className="max-w-3xl divide-y divide-border/70 border-y border-border/70">
      <section className="space-y-5 py-6" aria-labelledby="admin-display-settings">
        <div>
          <h2 id="admin-display-settings" className="text-base font-semibold text-foreground">
            Display
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Control how much information fits on each back-office screen.
          </p>
        </div>
        <label
          htmlFor="admin-ui-density"
          className="flex flex-col gap-2"
        >
          <span className="text-sm font-medium text-foreground">Layout density</span>
          <span className="text-xs text-muted-foreground">
            Compact tightens navigation and table spacing; comfortable gives controls more breathing room.
          </span>
        </label>
        <select
          id="admin-ui-density"
          value={prefs.uiDensity}
          onChange={(e) =>
            update({ uiDensity: e.target.value as AdminPreferences["uiDensity"] })
          }
          className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
        <label
          htmlFor="admin-inv-page"
          className="flex flex-col gap-2"
        >
          <span className="text-sm font-medium text-foreground">Default inventory rows per page</span>
          <span className="text-xs text-muted-foreground">
            Used when Inventory opens without a page size in the address bar. Operators can still change it per visit.
          </span>
        </label>
        <select
          id="admin-inv-page"
          value={prefs.inventoryPageSize}
          onChange={(e) =>
            update({
              inventoryPageSize: Number(e.target.value) as AdminPreferences["inventoryPageSize"],
            })
          }
          className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value={25}>25 rows</option>
          <option value={50}>50 rows</option>
          <option value={100}>100 rows</option>
        </select>
      </section>

      <section className="space-y-5 py-6" aria-labelledby="admin-accessibility-settings">
        <div>
          <h2 id="admin-accessibility-settings" className="text-base font-semibold text-foreground">
            Accessibility
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep operational feedback clear without unnecessary animation.
          </p>
        </div>
        <label htmlFor="admin-reduce-motion" className="flex items-start gap-3">
          <input
            id="admin-reduce-motion"
            type="checkbox"
            checked={prefs.reduceMotion}
            onChange={(e) => update({ reduceMotion: e.target.checked })}
            className="mt-1 size-4 rounded border-input text-primary focus:ring-primary"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">Reduce motion</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              Limits non-essential transitions and animations across the admin workspace. Essential status changes remain visible.
            </span>
          </span>
        </label>
      </section>

      <section className="flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:justify-between" aria-labelledby="admin-storage-settings">
        <div>
          <h2 id="admin-storage-settings" className="text-base font-semibold text-foreground">
            This browser
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
            These workspace preferences are stored locally in this browser and do not change organization settings or other operators’ workspaces.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"
        >
          Reset workspace settings
        </button>
      </section>

      {saved ? (
        <p className="border-t border-border/70 py-4 text-xs text-emerald-700" role="status">
          Workspace settings saved on this device.
        </p>
      ) : null}
    </div>
  );
}
