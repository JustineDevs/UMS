const KEY = "universal_music_store_wishlist_v1";
const MAX_WISHLIST_SIZE = 200;
const SYNC_DONE_KEY = "ums_wishlist_synced_v2";

export function wishlistSyncStorageKey(identity: string): string {
  const normalized = identity.trim().toLowerCase();
  return `${SYNC_DONE_KEY}:${normalized || "unknown"}`;
}

export type WishlistEntry = {
  slug: string;
  name: string;
  /** Medusa `product.id` when added from PDP; keeps identity stable if handle changes. */
  medusaProductId?: string;
  addedAt: string;
};

function readRaw(): unknown {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as unknown;
  } catch {
    return [];
  }
}

export function getWishlist(): WishlistEntry[] {
  const raw = readRaw();
  if (!Array.isArray(raw)) return [];
  const out: WishlistEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    if (typeof o.slug !== "string" || typeof o.name !== "string") continue;
    const mid =
      typeof o.medusaProductId === "string" && o.medusaProductId.trim()
        ? o.medusaProductId.trim()
        : undefined;
    out.push({
      slug: o.slug,
      name: o.name,
      ...(mid ? { medusaProductId: mid } : {}),
      addedAt:
        typeof o.addedAt === "string" ? o.addedAt : new Date().toISOString(),
    });
  }
  return out;
}

function write(entries: WishlistEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent("wishlistchange"));
}

export async function persistWishlistMutation(
  entry: Pick<WishlistEntry, "slug" | "name" | "medusaProductId">,
  action: "add" | "remove",
): Promise<void> {
  const response = await fetch("/api/wishlist", {
    method: action === "add" ? "POST" : "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ medusaProductId: entry.medusaProductId?.trim() ?? "" }),
  });
  if (!response.ok) {
    throw new Error("Saved items could not be synchronized.");
  }
}

export function wishlistContains(slug: string, medusaProductId?: string): boolean {
  const mid = medusaProductId?.trim();
  return getWishlist().some((e) => {
    if (mid && e.medusaProductId?.trim() === mid) return true;
    return e.slug === slug;
  });
}

export function toggleWishlist(
  entry: Pick<WishlistEntry, "slug" | "name" | "medusaProductId">,
): boolean {
  const list = getWishlist();
  const mid = entry.medusaProductId?.trim();
  const i = list.findIndex((e) => {
    if (mid && e.medusaProductId?.trim() === mid) return true;
    return e.slug === entry.slug;
  });
  if (i >= 0) {
    list.splice(i, 1);
    write(list);
    return false;
  }
  if (list.length >= MAX_WISHLIST_SIZE) {
    list.shift();
  }
  list.push({
    slug: entry.slug,
    name: entry.name,
    ...(mid ? { medusaProductId: mid } : {}),
    addedAt: new Date().toISOString(),
  });
  write(list);
  return true;
}

export function clearWishlist(): void {
  write([]);
}

export function exportWishlistJSON(): string {
  return JSON.stringify(getWishlist(), null, 2);
}

export function importWishlistJSON(json: string): number {
  const parsed = JSON.parse(json) as unknown;
  if (!Array.isArray(parsed)) return 0;
  const current = getWishlist();
  const slugs = new Set(current.map((e) => e.slug));
  let added = 0;
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    if (typeof o.slug !== "string" || typeof o.name !== "string") continue;
    if (slugs.has(o.slug)) continue;
    if (current.length >= MAX_WISHLIST_SIZE) break;
    const impMid =
      typeof o.medusaProductId === "string" && o.medusaProductId.trim()
        ? o.medusaProductId.trim()
        : undefined;
    current.push({
      slug: o.slug,
      name: o.name,
      ...(impMid ? { medusaProductId: impMid } : {}),
      addedAt:
        typeof o.addedAt === "string" ? o.addedAt : new Date().toISOString(),
    });
    slugs.add(o.slug);
    added++;
  }
  write(current);
  return added;
}

export function onWishlistChange(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  function handler(e: StorageEvent) {
    if (e.key === KEY) callback();
  }
  const localHandler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener("wishlistchange", localHandler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("wishlistchange", localHandler);
  };
}
