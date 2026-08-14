/**
 * Client-side preference storage (localStorage). Safe to import anywhere;
 * read/write functions no-op on the server.
 */

const LEGACY_STOREFRONT_KEY = "universal_music_store_preferences_v1";
export const STOREFRONT_PREF_KEY = "universal_music_store_storefront_prefs_v2";
export const ADMIN_PREF_KEY = "universal_music_store_admin_prefs_v1";

export type StorefrontPreferences = {
  language: "en" | "fil";
  measurementUnit: "metric" | "imperial";
  /** Spacing for product grids and list cards */
  density: "comfortable" | "compact";
  /** Limit non-essential motion */
  reduceMotion: boolean;
};

export type AdminPreferences = {
  /** Sidebar and table spacing */
  uiDensity: "comfortable" | "compact";
  /** Default rows for inventory and similar tables */
  inventoryPageSize: 25 | 50 | 100;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function defaultStorefrontPreferences(): StorefrontPreferences {
  return {
    language: "en",
    measurementUnit: "metric",
    density: "comfortable",
    reduceMotion: false,
  };
}

export function defaultAdminPreferences(): AdminPreferences {
  return {
    uiDensity: "comfortable",
    inventoryPageSize: 25,
  };
}

function migrateLegacyStorefront(): StorefrontPreferences | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_STOREFRONT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<{
      language: string;
      measurementUnit: string;
    }>;
    const base = defaultStorefrontPreferences();
    return {
      ...base,
      language: parsed.language === "fil" ? "fil" : "en",
      measurementUnit: parsed.measurementUnit === "imperial" ? "imperial" : "metric",
    };
  } catch {
    return null;
  }
}

export function readStorefrontPreferences(): StorefrontPreferences {
  if (!isBrowser()) return defaultStorefrontPreferences();
  try {
    const v2 = window.localStorage.getItem(STOREFRONT_PREF_KEY);
    if (v2) {
      const parsed = JSON.parse(v2) as Partial<StorefrontPreferences>;
      return { ...defaultStorefrontPreferences(), ...parsed };
    }
    const migrated = migrateLegacyStorefront();
    if (migrated) {
      writeStorefrontPreferences(migrated);
      return migrated;
    }
  } catch {
    /* ignore */
  }
  return defaultStorefrontPreferences();
}

export function writeStorefrontPreferences(patch: Partial<StorefrontPreferences>): void {
  if (!isBrowser()) return;
  try {
    const next = { ...readStorefrontPreferences(), ...patch };
    window.localStorage.setItem(STOREFRONT_PREF_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("storefront-prefs-updated"));
  } catch {
    /* ignore */
  }
}

export function readAdminPreferences(): AdminPreferences {
  if (!isBrowser()) return defaultAdminPreferences();
  try {
    const raw = window.localStorage.getItem(ADMIN_PREF_KEY);
    if (!raw) return defaultAdminPreferences();
    const parsed = JSON.parse(raw) as Partial<AdminPreferences>;
    const base = defaultAdminPreferences();
    const inventoryPageSize =
      parsed.inventoryPageSize === 50 || parsed.inventoryPageSize === 100
        ? parsed.inventoryPageSize
        : 25;
    const uiDensity = parsed.uiDensity === "compact" ? "compact" : "comfortable";
    return { ...base, inventoryPageSize, uiDensity };
  } catch {
    return defaultAdminPreferences();
  }
}

export function writeAdminPreferences(patch: Partial<AdminPreferences>): void {
  if (!isBrowser()) return;
  try {
    const next = { ...readAdminPreferences(), ...patch };
    window.localStorage.setItem(ADMIN_PREF_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("admin-prefs-updated"));
  } catch {
    /* ignore */
  }
}
