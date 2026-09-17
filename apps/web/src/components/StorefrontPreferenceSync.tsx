"use client";

import { useEffect } from "react";
import { readStorefrontPreferences } from "@universal-music-store/user-preferences";

/**
 * Applies storefront preferences to the document root for CSS and a11y hooks.
 */
export function StorefrontPreferenceSync() {
  useEffect(() => {
    const apply = () => {
      const p = readStorefrontPreferences();
      document.documentElement.dataset.storeDensity = p.density;
      document.documentElement.dataset.reduceMotion = p.reduceMotion ? "true" : "false";
    };
    apply();
    window.addEventListener("storefront-prefs-updated", apply);
    window.addEventListener("storage", apply);
    return () => {
      window.removeEventListener("storefront-prefs-updated", apply);
      window.removeEventListener("storage", apply);
    };
  }, []);

  return null;
}
