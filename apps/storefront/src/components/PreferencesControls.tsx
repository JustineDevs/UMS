"use client";

import { useCallback, useEffect, useState } from "react";
import {
  defaultStorefrontPreferences,
  readStorefrontPreferences,
  writeStorefrontPreferences,
  type StorefrontPreferences,
} from "@universal-music-store/user-preferences";

export function PreferencesControls() {
  const [prefs, setPrefs] = useState<StorefrontPreferences>(defaultStorefrontPreferences);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPrefs(readStorefrontPreferences());
  }, []);

  const update = useCallback((patch: Partial<StorefrontPreferences>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
    writeStorefrontPreferences(patch);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }, []);

  return (
    <section className="rounded border border-outline-variant/20 bg-surface-container-lowest p-6 space-y-5">
      <h2 className="font-headline text-lg font-bold text-primary">
        Your preferences
      </h2>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="pref-lang"
          className="text-xs font-bold uppercase tracking-widest text-on-surface-variant"
        >
          Language
        </label>
        <select
          id="pref-lang"
          value={prefs.language}
          onChange={(e) =>
            update({ language: e.target.value as StorefrontPreferences["language"] })
          }
          className="w-full max-w-xs rounded border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="en">English</option>
          <option value="fil">Filipino</option>
        </select>
        <p className="text-xs text-on-surface-variant mt-1">
          Product content and UI copy will display in your selected language when translations are
          available.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="pref-unit"
          className="text-xs font-bold uppercase tracking-widest text-on-surface-variant"
        >
          Measurement unit
        </label>
        <select
          id="pref-unit"
          value={prefs.measurementUnit}
          onChange={(e) =>
            update({
              measurementUnit: e.target.value as StorefrontPreferences["measurementUnit"],
            })
          }
          className="w-full max-w-xs rounded border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="metric">Metric (cm, kg)</option>
          <option value="imperial">Imperial (in, lb)</option>
        </select>
        <p className="text-xs text-on-surface-variant mt-1">
          Applies to sizing charts and product dimensions.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="pref-density"
          className="text-xs font-bold uppercase tracking-widest text-on-surface-variant"
        >
          Shop layout
        </label>
        <select
          id="pref-density"
          value={prefs.density}
          onChange={(e) =>
            update({ density: e.target.value as StorefrontPreferences["density"] })
          }
          className="w-full max-w-xs rounded border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="comfortable">Comfortable spacing</option>
          <option value="compact">Compact spacing</option>
        </select>
        <p className="text-xs text-on-surface-variant mt-1">
          Compact tightens product grids and list spacing on this device.
        </p>
      </div>

      <div className="flex items-start gap-3">
        <input
          id="pref-motion"
          type="checkbox"
          checked={prefs.reduceMotion}
          onChange={(e) => update({ reduceMotion: e.target.checked })}
          className="mt-1 h-4 w-4 rounded border-outline-variant/40 text-primary focus:ring-primary"
        />
        <div>
          <label htmlFor="pref-motion" className="text-sm font-medium text-on-surface">
            Reduce motion
          </label>
          <p className="text-xs text-on-surface-variant mt-1">
            Limits decorative movement. Does not remove essential feedback.
          </p>
        </div>
      </div>

      {saved ? (
        <p className="text-xs text-emerald-700" role="status">
          Preferences saved to this device.
        </p>
      ) : null}
    </section>
  );
}
