"use client";

import { useCallback, useEffect, useState } from "react";
import {
  defaultAdminPreferences,
  readAdminPreferences,
  writeAdminPreferences,
  type AdminPreferences,
} from "@universal-music-store/user-preferences";

export function AdminPreferencesForm() {
  const [prefs, setPrefs] = useState<AdminPreferences>(defaultAdminPreferences);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPrefs(readAdminPreferences());
  }, []);

  const update = useCallback((patch: Partial<AdminPreferences>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
    writeAdminPreferences(patch);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }, []);

  return (
    <div className="max-w-xl space-y-8 rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-8 shadow-sm">
      <div>
        <label
          htmlFor="admin-ui-density"
          className="text-xs font-bold uppercase tracking-widest text-on-surface-variant"
        >
          Layout density
        </label>
        <select
          id="admin-ui-density"
          value={prefs.uiDensity}
          onChange={(e) =>
            update({ uiDensity: e.target.value as AdminPreferences["uiDensity"] })
          }
          className="mt-2 w-full max-w-md rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm text-on-surface"
        >
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
          Compact tightens spacing in the back office. Use what is easier to scan on your screen.
        </p>
      </div>

      <div>
        <label
          htmlFor="admin-inv-page"
          className="text-xs font-bold uppercase tracking-widest text-on-surface-variant"
        >
          Default inventory rows per page
        </label>
        <select
          id="admin-inv-page"
          value={prefs.inventoryPageSize}
          onChange={(e) =>
            update({
              inventoryPageSize: Number(e.target.value) as AdminPreferences["inventoryPageSize"],
            })
          }
          className="mt-2 w-full max-w-md rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm text-on-surface"
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
          Used when you open Inventory without a page size in the address bar. You can still change
          rows on the Inventory screen.
        </p>
      </div>

      {saved ? (
        <p className="text-xs text-emerald-800" role="status">
          Saved on this device.
        </p>
      ) : null}
    </div>
  );
}
