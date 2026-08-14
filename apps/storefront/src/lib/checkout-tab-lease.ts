/**
 * Cross-tab checkout coordination (UX aid). Server-side quote fingerprint checks remain authoritative.
 * Two tabs: higher lexicographic tab id "wins" active checkout; the other is read-only.
 */

const CHANNEL_NAME = "universal-music-store-checkout-lease-v1";

type CheckoutLeaseMessage =
  | { type: "owner"; tabId: string; ts: number }
  | { type: "release"; tabId: string };

function getTabId(): string {
  if (typeof window === "undefined") return "";
  try {
    const k = "universal_music_store_checkout_tab_id";
    let id = sessionStorage.getItem(k)?.trim();
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(k, id);
    }
    return id;
  } catch {
    return `tab_${Date.now()}`;
  }
}

/**
 * When `enabled` is true, participates in lease broadcast. Call from checkout only when the user has a non-empty bag.
 */
export function createCheckoutLeaseSubscriber(
  enabled: boolean,
  onForeignChange: (_foreign: boolean) => void,
): () => void {
  if (typeof window === "undefined" || !enabled) {
    return () => {};
  }
  if (typeof BroadcastChannel === "undefined") {
    return () => {};
  }

  const tabId = getTabId();
  const ch = new BroadcastChannel(CHANNEL_NAME);

  const tick = () => {
    ch.postMessage({
      type: "owner",
      tabId,
      ts: Date.now(),
    } satisfies CheckoutLeaseMessage);
  };

  const onMessage = (ev: MessageEvent) => {
    const data = ev.data as CheckoutLeaseMessage | undefined;
    if (!data || data.type !== "owner") return;
    if (data.tabId === tabId) return;
    // Stable tie-break: higher tab id is treated as the active checkout tab.
    onForeignChange(data.tabId > tabId);
  };

  ch.addEventListener("message", onMessage);
  tick();
  const interval = window.setInterval(tick, 900);

  const onUnload = () => {
    try {
      ch.postMessage({ type: "release", tabId } satisfies CheckoutLeaseMessage);
    } catch {
      /* ignore */
    }
  };
  window.addEventListener("beforeunload", onUnload);

  return () => {
    window.clearInterval(interval);
    ch.removeEventListener("message", onMessage);
    window.removeEventListener("beforeunload", onUnload);
    onUnload();
    ch.close();
  };
}

;
