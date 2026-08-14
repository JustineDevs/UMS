"use client";

import { useEffect } from "react";
import { readAdminPreferences } from "@universal-music-store/user-preferences";

/** Applies the saved admin spacing preference to the document root. */
export function AdminPreferenceSync() {
  useEffect(() => {
    const apply = () => {
      const p = readAdminPreferences();
      document.documentElement.dataset.adminDensity = p.uiDensity;
    };
    apply();
    window.addEventListener("admin-prefs-updated", apply);
    window.addEventListener("storage", apply);
    return () => {
      window.removeEventListener("admin-prefs-updated", apply);
      window.removeEventListener("storage", apply);
    };
  }, []);

  return null;
}
