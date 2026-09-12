import type { WorkerDatabaseClient } from "./database.ts";

export type TrackingEnv = {
  TRACKING_HMAC_SECRET?: string;
  TRACKING_HMAC_KEY_VERSION?: string;
  TRACKING_HMAC_PREVIOUS_KEY_VERSION?: string;
  TRACKING_HMAC_SECRET_PREVIOUS?: string;
};

type Capability = {
  id: string;
  scope?: { customerEmailHash?: string; storeId?: string };
};

type OrderRow = {
  id: string;
  display_id: string | number | null;
  updated_at: string;
  payment_status: string | null;
  fulfillment_status: string | null;
  email: string | null;
  metadata: Record<string, unknown> | null;
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
    const decoded = atob(padded);
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function capabilitySecret(version: string, env: TrackingEnv): string | null {
  const current = env.TRACKING_HMAC_KEY_VERSION?.trim() || "v1";
  if (version === current) return env.TRACKING_HMAC_SECRET?.trim() || null;
  if (version === env.TRACKING_HMAC_PREVIOUS_KEY_VERSION?.trim()) {
    return env.TRACKING_HMAC_SECRET_PREVIOUS?.trim() || null;
  }
  return null;
}

async function resolveCapability(token: string, env: TrackingEnv): Promise<Capability | null> {
  const [version, keyVersion, issuedAtRaw, expiresAtRaw, ivRaw, tagRaw, ciphertextRaw] = token.split(".");
  const issuedAt = Number(issuedAtRaw);
  const expiresAt = Number(expiresAtRaw);
  const now = Math.floor(Date.now() / 1000);
  if (
    version !== "v3" || !keyVersion || !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(expiresAt) || issuedAt > now || expiresAt <= now ||
    expiresAt <= issuedAt || !ivRaw || !tagRaw || !ciphertextRaw
  ) return null;
  const secret = capabilitySecret(keyVersion, env);
  const iv = decodeBase64Url(ivRaw);
  const tag = decodeBase64Url(tagRaw);
  const ciphertext = decodeBase64Url(ciphertextRaw);
  if (!secret || !iv || !tag || !ciphertext || iv.byteLength !== 12 || tag.byteLength !== 16) return null;
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
    const key = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["decrypt"]);
    const encrypted = new Uint8Array(ciphertext.byteLength + tag.byteLength);
    encrypted.set(ciphertext);
    encrypted.set(tag, ciphertext.byteLength);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv.buffer as ArrayBuffer, tagLength: 128 }, key, encrypted.buffer as ArrayBuffer);
    const payload = JSON.parse(new TextDecoder().decode(plaintext)) as {
      version?: string; purpose?: string; audience?: string; keyVersion?: string;
      id?: string; issuedAt?: number; expiresAt?: number;
      scope?: { customerEmailHash?: string; storeId?: string };
    };
    if (
      payload.version !== version || payload.purpose !== "track" || payload.audience !== "public-tracking" ||
      payload.keyVersion !== keyVersion || payload.issuedAt !== issuedAt || payload.expiresAt !== expiresAt ||
      typeof payload.id !== "string" || !/^order_[A-Za-z0-9_-]+$/.test(payload.id)
    ) return null;
    const scope = payload.scope && typeof payload.scope === "object"
      ? {
          ...(typeof payload.scope.customerEmailHash === "string" && /^[a-f0-9]{64}$/.test(payload.scope.customerEmailHash)
            ? { customerEmailHash: payload.scope.customerEmailHash } : {}),
          ...(typeof payload.scope.storeId === "string" && payload.scope.storeId.trim()
            ? { storeId: payload.scope.storeId.trim().slice(0, 128) } : {}),
        }
      : undefined;
    return { id: payload.id, ...(scope && Object.keys(scope).length > 0 ? { scope } : {}) };
  } catch {
    return null;
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function status(row: OrderRow): string {
  const metadata = row.metadata ?? {};
  const events = Array.isArray(metadata.pancake_pos_events) ? metadata.pancake_pos_events :
    Array.isArray(metadata.shipment_events) ? metadata.shipment_events : [];
  const latest = events
    .filter((event): event is Record<string, unknown> => Boolean(event && typeof event === "object"))
    .sort((a, b) => Date.parse(String(b.occurred_at ?? "")) - Date.parse(String(a.occurred_at ?? "")))[0];
  if (latest?.status === "delivered") return "delivered";
  if (["out_for_delivery", "in_transit", "shipped"].includes(String(latest?.status))) return "shipped";
  if (metadata.payment_provider === "cod" && metadata.cod_payment_status !== "captured" && metadata.cod_capture_complete !== true) return "pending_payment";
  if (!/captured|partially_captured/i.test(row.payment_status ?? "")) return "pending_payment";
  const fulfillment = row.fulfillment_status ?? "";
  if (["delivered", "partially_delivered"].includes(fulfillment)) return "delivered";
  if (["shipped", "partially_shipped", "fulfilled", "partially_fulfilled"].includes(fulfillment)) return "shipped";
  return "paid";
}

function shipments(row: OrderRow): Array<Record<string, unknown>> {
  const metadata = row.metadata ?? {};
  const source = Array.isArray(metadata.pancake_pos_shipments) && metadata.pancake_pos_shipments.length > 0
    ? metadata.pancake_pos_shipments : Array.isArray(metadata.fulfillment_shipments) ? metadata.fulfillment_shipments : [];
  return source.flatMap((value, index) => {
    if (!value || typeof value !== "object") return [];
    const shipment = value as Record<string, unknown>;
    const tracking = typeof shipment.tracking_number === "string" ? shipment.tracking_number.trim().slice(0, 80) : undefined;
    return [{
      id: typeof shipment.id === "string" ? shipment.id : `shipment-${index}`,
      ...(tracking ? { tracking_number: tracking } : {}),
      ...(typeof shipment.status === "string" ? { status: shipment.status } : {}),
      ...(typeof shipment.carrier_slug === "string" ? { carrier_slug: shipment.carrier_slug } : {}),
      ...(typeof shipment.updated_at === "string" ? { updated_at: shipment.updated_at } : {}),
    }];
  });
}

export async function handleTrackingRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: TrackingEnv,
  token: string,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const capability = await resolveCapability(token, env);
  if (!capability) return json({ error: "not_found" }, 404);
  const result = await database.query<OrderRow>(
    `SELECT id, display_id, updated_at, payment_status, fulfillment_status, email, metadata
       FROM public."order" WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [capability.id],
  );
  const row = result.rows[0];
  if (!row) return json({ error: "not_found" }, 404);
  if (capability.scope?.customerEmailHash) {
    if (!row.email || await sha256Hex(row.email.trim().toLowerCase()) !== capability.scope.customerEmailHash) return json({ error: "not_found" }, 404);
  }
  const metadata = row.metadata ?? {};
  if (capability.scope?.storeId) {
    const storeId = typeof metadata.store_id === "string" ? metadata.store_id : typeof metadata.organization_id === "string" ? metadata.organization_id : null;
    if (storeId !== capability.scope.storeId) return json({ error: "not_found" }, 404);
  }
  return json({
    order: {
      order_number: row.display_id == null ? undefined : String(row.display_id),
      status: status(row),
      updated_at: row.updated_at,
    },
    shipments: shipments(row),
    ...(capability.scope ? { capabilityScope: capability.scope } : {}),
  });
}
